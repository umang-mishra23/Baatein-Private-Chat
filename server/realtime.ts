import "dotenv/config";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { Server, Socket } from "socket.io";
import { MessageStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { hashSessionToken, hashIp } from "@/lib/security";
import {
  createMessage,
  getConversationForUser,
  markConversationDelivered,
  markConversationRead,
  markMessageDeleted,
} from "@/server/conversations/service";
import {
  socketConversationSchema,
  socketDeleteMessageSchema,
  socketMessageSchema,
  socketReadSchema,
} from "@/lib/validation";
import { allowRateLimit } from "@/server/rate-limit";

const port = Number(process.env.REALTIME_PORT ?? 4001);
const allowedOrigins = (process.env.REALTIME_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const httpServer = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ status: "ok", service: "realtime" }));
    return;
  }
  response.writeHead(404, { "cache-control": "no-store" });
  response.end();
});

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, credentials: true },
  transports: ["websocket", "polling"],
  maxHttpBufferSize: 32 * 1024,
  connectTimeout: 20_000,
  allowRequest: (request, callback) => {
    const origin = request.headers.origin;
    callback(null, Boolean(origin && allowedOrigins.includes(origin)));
  },
});

type Ack = (value: { ok: boolean; message?: unknown; error?: string; online?: boolean }) => void;
type AuthenticatedSocket = Socket & { data: { userId: string; sessionIdHash: string; username: string } };
const presence = new Map<string, Set<string>>();

function roomFor(conversationId: string) { return `conversation:${conversationId}`; }

function cookieValue(header: string | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      try { return decodeURIComponent(value.join("=")); } catch { return null; }
    }
  }
  return null;
}

function userIsOnline(userId: string) { return Boolean(presence.get(userId)?.size); }

function allowUserEvent(socket: AuthenticatedSocket, event: string, limit: number, windowMs: number) {
  return allowRateLimit(`socket:${event}:${socket.data.userId}`, limit, windowMs);
}

async function assertLiveSession(socket: AuthenticatedSocket, ack?: Ack) {
  const session = await db.session.findUnique({
    where: { idHash: socket.data.sessionIdHash },
    select: { revokedAt: true, expiresAt: true, user: { select: { status: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") {
    ack?.({ ok: false, error: "Session unavailable." });
    socket.disconnect(true);
    return false;
  }
  return true;
}

function addPresence(userId: string, socketId: string) {
  const set = presence.get(userId) ?? new Set<string>();
  set.add(socketId);
  presence.set(userId, set);
}

function removePresence(userId: string, socketId: string) {
  const set = presence.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (!set.size) presence.delete(userId);
}

io.use(async (socket, next) => {
  try {
    const origin = socket.handshake.headers.origin;
    // Browser chat sessions must have an explicit, allowed Origin.
    if (!origin || !allowedOrigins.includes(origin)) return next(new Error("Origin not allowed"));

    const rawToken = cookieValue(socket.handshake.headers.cookie, "pc_session");
    if (!rawToken) return next(new Error("Session required"));
    const session = await db.session.findUnique({
      where: { idHash: hashSessionToken(rawToken) },
      select: {
        idHash: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { id: true, username: true, status: true } },
      },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== "ACTIVE" || !session.user.username) {
      return next(new Error("Session unavailable"));
    }

    const ipHash = hashIp(String(socket.handshake.address ?? "unknown"));
    if (!allowRateLimit(`socket:handshake:${ipHash}`, 120, 60 * 1000)) return next(new Error("Too many connection attempts"));

    (socket as AuthenticatedSocket).data = {
      userId: session.user.id,
      sessionIdHash: session.idHash,
      username: session.user.username,
    };
    next();
  } catch {
    next(new Error("Session unavailable"));
  }
});

io.on("connection", (rawSocket) => {
  const socket = rawSocket as AuthenticatedSocket;
  addPresence(socket.data.userId, socket.id);

  socket.on("conversation:join", async (payload: unknown, ack?: Ack) => {
    const parsed = socketConversationSchema.safeParse(payload);
    if (!parsed.success) return ack?.({ ok: false, error: "Conversation unavailable." });
    const { conversationId } = parsed.data;
    try {
      if (!(await assertLiveSession(socket, ack))) return;
      if (!allowUserEvent(socket, "join", 30, 60_000)) return ack?.({ ok: false, error: "Too many requests. Please slow down." });
      const conversation = await getConversationForUser(socket.data.userId, conversationId);
      socket.join(roomFor(conversationId));
      const peerOnline = userIsOnline(conversation.peer.id);
      const delivered = await markConversationDelivered(socket.data.userId, conversationId);
      if (delivered.messageIds.length) {
        socket.to(roomFor(conversationId)).emit("message:delivery", {
          conversationId,
          messageIds: delivered.messageIds,
          status: MessageStatus.DELIVERED,
        });
      }
      socket.to(roomFor(conversationId)).emit("presence:update", { userId: socket.data.userId, online: true });
      socket.emit("presence:update", { userId: conversation.peer.id, online: peerOnline });
      ack?.({ ok: true, online: peerOnline });
    } catch {
      ack?.({ ok: false, error: "Conversation unavailable." });
    }
  });

  socket.on("conversation:leave", (payload: unknown) => {
    const parsed = socketConversationSchema.safeParse(payload);
    if (parsed.success) socket.leave(roomFor(parsed.data.conversationId));
  });

  socket.on("message:send", async (payload: unknown, ack?: Ack) => {
    const parsed = socketMessageSchema.safeParse(payload);
    if (!parsed.success) return ack?.({ ok: false, error: "Invalid message." });
    const { conversationId, text, clientMessageId } = parsed.data;
    try {
      if (!(await assertLiveSession(socket, ack))) return;
      if (!allowUserEvent(socket, "message", 120, 60_000)) return ack?.({ ok: false, error: "Too many messages. Please slow down." });

      // Preserve the client idempotency key on the socket path as well as REST.
      const result = await createMessage(socket.data.userId, conversationId, text, clientMessageId ?? randomUUID());
      let message = result.message;
      if (userIsOnline(result.peerId)) {
        await db.messageReceipt.updateMany({
          where: { messageId: message.id, userId: result.peerId, status: MessageStatus.SENT },
          data: { status: MessageStatus.DELIVERED },
        });
        message = { ...message, deliveryStatus: MessageStatus.DELIVERED };
      }
      io.to(roomFor(conversationId)).emit("message:new", message);
      if (message.deliveryStatus === MessageStatus.DELIVERED) {
        io.to(roomFor(conversationId)).emit("message:delivery", {
          conversationId, messageIds: [message.id], status: MessageStatus.DELIVERED,
        });
      }
      ack?.({ ok: true, message });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (["CONVERSATION_FORBIDDEN", "CONVERSATION_UNAVAILABLE", "USER_BLOCKED"].includes(code)) {
        return ack?.({ ok: false, error: "Conversation unavailable." });
      }
      if (code === "INVALID_MESSAGE") return ack?.({ ok: false, error: "Invalid message." });
      ack?.({ ok: false, error: "Unable to send message." });
    }
  });

  const handleTyping = (typing: boolean) => async (payload: unknown) => {
    const parsed = socketConversationSchema.safeParse(payload);
    if (!parsed.success) return;
    try {
      if (!(await assertLiveSession(socket))) return;
      if (!allowUserEvent(socket, "typing", 40, 60_000)) return;
      const { conversationId } = parsed.data;
      await getConversationForUser(socket.data.userId, conversationId);
      socket.to(roomFor(conversationId)).emit("typing:update", { userId: socket.data.userId, typing });
    } catch { /* Generic rejection; never disclose membership details. */ }
  };
  socket.on("typing:start", handleTyping(true));
  socket.on("typing:stop", handleTyping(false));

  socket.on("conversation:read", async (payload: unknown, ack?: Ack) => {
    const parsed = socketReadSchema.safeParse(payload);
    if (!parsed.success) return ack?.({ ok: false, error: "Invalid read receipt." });
    try {
      if (!(await assertLiveSession(socket, ack))) return;
      if (!allowUserEvent(socket, "read", 120, 60_000)) return ack?.({ ok: false, error: "Too many requests. Please slow down." });
      const { conversationId, messageId } = parsed.data;
      const result = await markConversationRead(socket.data.userId, conversationId, messageId);
      if (result.messageIds.length) {
        io.to(roomFor(conversationId)).emit("message:delivery", {
          conversationId, messageIds: result.messageIds, status: MessageStatus.READ,
        });
      }
      ack?.({ ok: true });
    } catch {
      ack?.({ ok: false, error: "Unable to update read status." });
    }
  });

  socket.on("message:delete", async (payload: unknown, ack?: Ack) => {
    const parsed = socketDeleteMessageSchema.safeParse(payload);
    if (!parsed.success) return ack?.({ ok: false, error: "Message unavailable." });
    try {
      if (!(await assertLiveSession(socket, ack))) return;
      if (!allowUserEvent(socket, "delete", 30, 60_000)) return ack?.({ ok: false, error: "Too many requests. Please slow down." });
      const { conversationId, messageId } = parsed.data;
      const result = await markMessageDeleted(socket.data.userId, conversationId, messageId);
      io.to(roomFor(conversationId)).emit("message:deleted", { conversationId, messageId: result.messageId });
      ack?.({ ok: true });
    } catch {
      ack?.({ ok: false, error: "Message unavailable." });
    }
  });

  socket.on("disconnect", () => {
    const wasOnline = userIsOnline(socket.data.userId);
    removePresence(socket.data.userId, socket.id);
    const isOnline = userIsOnline(socket.data.userId);
    if (wasOnline && !isOnline) {
      for (const room of socket.rooms) {
        if (room.startsWith("conversation:")) {
          io.to(room).emit("presence:update", { userId: socket.data.userId, online: false });
        }
      }
    }
  });
});

httpServer.listen(port, () => console.log(`Realtime service listening on http://localhost:${port}`));
