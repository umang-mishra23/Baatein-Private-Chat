import "dotenv/config";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { Server, Socket } from "socket.io";
import { MessageStatus } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { hashSessionToken, hashIp } from "@/lib/security";
import { createMessage, getConversationForUser, markConversationDelivered, markConversationRead, markMessageDeleted } from "@/server/conversations/service";
import { messageSchema } from "@/lib/validation";
import { allowRateLimit } from "@/server/rate-limit";

const port = Number(process.env.REALTIME_PORT ?? 4001);
const allowedOrigins = (process.env.REALTIME_ORIGIN ?? "http://localhost:3000").split(",").map((value) => value.trim()).filter(Boolean);
const httpServer = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "realtime" }));
    return;
  }
  response.writeHead(404);
  response.end();
});
const io = new Server(httpServer, { cors: { origin: allowedOrigins, credentials: true }, transports: ["websocket", "polling"], allowRequest: (req, callback) => {
  const origin = req.headers.origin;
  callback(null, Boolean(origin && allowedOrigins.includes(origin)));
} });

type AuthenticatedSocket = Socket & { data: { userId: string; sessionIdHash: string; username: string } };
const presence = new Map<string, Set<string>>();

function roomFor(conversationId: string) { return `conversation:${conversationId}`; }
function cookieValue(header: string | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}
function userIsOnline(userId: string) { return Boolean(presence.get(userId)?.size); }
function addPresence(userId: string, socketId: string) {
  const set = presence.get(userId) ?? new Set<string>();
  set.add(socketId);
  presence.set(userId, set);
}
function removePresence(userId: string, socketId: string) {
  const set = presence.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (!set.size) presence.delete(userId);
  return true;
}

io.use(async (socket, next) => {
  const origin = socket.handshake.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) return next(new Error("Origin not allowed"));
  const rawToken = cookieValue(socket.handshake.headers.cookie, "pc_session");
  if (!rawToken) return next(new Error("Session required"));
  const session = await db.session.findUnique({ where: { idHash: hashSessionToken(rawToken) }, select: { idHash: true, expiresAt: true, revokedAt: true, user: { select: { id: true, username: true, status: true } } } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== "ACTIVE" || !session.user.username) return next(new Error("Session unavailable"));
  (socket as AuthenticatedSocket).data = { userId: session.user.id, sessionIdHash: session.idHash, username: session.user.username };
  next();
});

io.on("connection", async (rawSocket) => {
  const socket = rawSocket as AuthenticatedSocket;
  addPresence(socket.data.userId, socket.id);

  socket.on("conversation:join", async ({ conversationId }: { conversationId?: string }, ack?: (value: { ok: boolean; error?: string; online?: boolean }) => void) => {
    try {
      if (!conversationId || !/^[0-9a-f-]{36}$/i.test(conversationId)) return ack?.({ ok: false, error: "Conversation unavailable" });
      const conversation = await getConversationForUser(socket.data.userId, conversationId);
      socket.join(roomFor(conversationId));
      const peerOnline = userIsOnline(conversation.peer.id);
      await markConversationDelivered(socket.data.userId, conversationId).then((result) => {
        if (result.messageIds.length) socket.to(roomFor(conversationId)).emit("message:delivery", { conversationId, messageIds: result.messageIds, status: MessageStatus.DELIVERED });
      });
      socket.to(roomFor(conversationId)).emit("presence:update", { userId: socket.data.userId, online: true });
      socket.emit("presence:update", { userId: conversation.peer.id, online: peerOnline });
      ack?.({ ok: true, online: peerOnline });
    } catch {
      ack?.({ ok: false, error: "Conversation unavailable" });
    }
  });

  socket.on("conversation:leave", ({ conversationId }: { conversationId?: string }) => {
    if (conversationId) socket.leave(roomFor(conversationId));
  });

  socket.on("message:send", async ({ conversationId, text }: { conversationId?: string; text?: unknown }, ack?: (value: { ok: boolean; message?: unknown; error?: string }) => void) => {
    try {
      if (!conversationId) return ack?.({ ok: false, error: "Conversation unavailable" });
      const parsed = messageSchema.safeParse({ text });
      if (!parsed.success) return ack?.({ ok: false, error: "Message must be between 1 and 4000 characters." });
      const ip = String(socket.handshake.address ?? "unknown");
      const key = `socket:message:${socket.data.userId}:${hashIp(ip)}`;
      if (!allowRateLimit(key, 120, 60 * 1000)) return ack?.({ ok: false, error: "Too many messages. Please slow down." });
      const result = await createMessage(socket.data.userId, conversationId, parsed.data.text, parsed.data.clientMessageId ?? randomUUID());
      let message = result.message;
      if (userIsOnline(result.peerId)) {
        await db.messageReceipt.updateMany({ where: { messageId: message.id, userId: result.peerId, status: MessageStatus.SENT }, data: { status: MessageStatus.DELIVERED } });
        message = { ...message, deliveryStatus: MessageStatus.DELIVERED };
      }
      io.to(roomFor(conversationId)).emit("message:new", message);
      if (message.deliveryStatus === MessageStatus.DELIVERED) io.to(roomFor(conversationId)).emit("message:delivery", { conversationId, messageIds: [message.id], status: MessageStatus.DELIVERED });
      ack?.({ ok: true, message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "CONVERSATION_FORBIDDEN" || message === "CONVERSATION_UNAVAILABLE") return ack?.({ ok: false, error: "Conversation unavailable." });
      if (message === "USER_BLOCKED") return ack?.({ ok: false, error: "This conversation is unavailable." });
      ack?.({ ok: false, error: "Unable to send message." });
    }
  });

  socket.on("typing:start", async ({ conversationId }: { conversationId?: string }) => {
    if (!conversationId) return;
    try { await getConversationForUser(socket.data.userId, conversationId); socket.to(roomFor(conversationId)).emit("typing:update", { userId: socket.data.userId, typing: true }); } catch {}
  });
  socket.on("typing:stop", async ({ conversationId }: { conversationId?: string }) => {
    if (!conversationId) return;
    try { await getConversationForUser(socket.data.userId, conversationId); socket.to(roomFor(conversationId)).emit("typing:update", { userId: socket.data.userId, typing: false }); } catch {}
  });

  socket.on("conversation:read", async ({ conversationId, messageId }: { conversationId?: string; messageId?: string }) => {
    if (!conversationId || !messageId) return;
    try {
      const result = await markConversationRead(socket.data.userId, conversationId, messageId);
      if (result.messageIds.length) io.to(roomFor(conversationId)).emit("message:delivery", { conversationId, messageIds: result.messageIds, status: MessageStatus.READ });
    } catch {}
  });

  socket.on("message:delete", async ({ conversationId, messageId }: { conversationId?: string; messageId?: string }, ack?: (value: { ok: boolean; error?: string }) => void) => {
    try {
      if (!conversationId || !messageId) return ack?.({ ok: false, error: "Message unavailable." });
      const result = await markMessageDeleted(socket.data.userId, conversationId, messageId);
      io.to(roomFor(conversationId)).emit("message:deleted", { conversationId, messageId: result.messageId });
      ack?.({ ok: true });
    } catch {
      ack?.({ ok: false, error: "Message unavailable." });
    }
  });

  socket.on("disconnect", async () => {
    const before = userIsOnline(socket.data.userId);
    removePresence(socket.data.userId, socket.id);
    const after = userIsOnline(socket.data.userId);
    if (before && !after) {
      for (const room of socket.rooms) {
        if (room.startsWith("conversation:")) io.to(room).emit("presence:update", { userId: socket.data.userId, online: false });
      }
    }
  });
});

httpServer.listen(port, () => console.log(`Realtime service listening on http://localhost:${port}`));
