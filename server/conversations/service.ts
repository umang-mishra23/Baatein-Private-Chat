import { MessageStatus } from "@/generated/prisma/client";
import { decryptMessage, encryptMessage } from "@/lib/security";
import { db } from "@/server/db";

export const MESSAGE_PAGE_SIZE = 40;
export const MESSAGE_MAX_LENGTH = 4000;

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const [createdAtRaw, id] = raw.split("|");
    if (!createdAtRaw || !id) return null;
    const createdAt = new Date(createdAtRaw);
    if (Number.isNaN(createdAt.getTime()) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

async function requireMembership(userId: string, conversationId: string) {
  const membership = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { conversationId: true, userId: true, leftAt: true, hiddenAt: true, conversation: { select: { id: true, status: true } } },
  });
  if (!membership || membership.leftAt || membership.hiddenAt || membership.conversation.status !== "ACTIVE") throw new Error("CONVERSATION_FORBIDDEN");
  return membership;
}

export async function getConversationForUser(userId: string, conversationId: string) {
  await requireMembership(userId, conversationId);
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, status: "ACTIVE", members: { some: { userId, leftAt: null } } },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      members: {
        where: { leftAt: null },
        select: { userId: true, joinedAt: true, user: { select: { id: true, username: true, status: true } } },
      },
    },
  });
  if (!conversation) throw new Error("CONVERSATION_FORBIDDEN");
  const peer = conversation.members.find((member) => member.userId !== userId);
  if (!peer || peer.user.status !== "ACTIVE" || !peer.user.username) throw new Error("CONVERSATION_UNAVAILABLE");
  await assertNotBlocked(userId, peer.userId);
  return {
    id: conversation.id,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    peer: { id: peer.user.id, username: peer.user.username },
  };
}

export async function listConversations(userId: string) {
  const rows = await db.conversation.findMany({
    where: { status: "ACTIVE", members: { some: { userId, leftAt: null, hiddenAt: null } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      members: {
        where: { leftAt: null },
        select: { userId: true, user: { select: { id: true, username: true, status: true } } },
      },
      messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { id: true, senderId: true, ciphertext: true, createdAt: true, deletedAt: true } },
    },
  });
  const blocks = await db.blockedUser.findMany({
    where: { OR: [{ blockerId: userId }, { blockedUserId: userId }] },
    select: { blockerId: true, blockedUserId: true },
  });
  const blockedPeers = new Set(blocks.map((row) => row.blockerId === userId ? row.blockedUserId : row.blockerId));
  return rows.flatMap((row) => {
    const peer = row.members.find((member) => member.userId !== userId);
    if (!peer || blockedPeers.has(peer.userId) || peer.user.status !== "ACTIVE" || !peer.user.username) return [];
    const last = row.messages[0];
    return [{
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      peer: { id: peer.user.id, username: peer.user.username },
      lastMessage: last ? {
        id: last.id,
        senderId: last.senderId,
        text: last.deletedAt ? "Message deleted" : decryptMessage(last.ciphertext),
        createdAt: last.createdAt,
      } : null,
    }];
  });
}

export async function listMessages(userId: string, conversationId: string, cursor?: string, requestedLimit?: number) {
  await requireMembership(userId, conversationId);
  const peer = await getConversationPeer(userId, conversationId);
  await assertNotBlocked(userId, peer.userId);
  const limit = Math.min(Math.max(requestedLimit ?? MESSAGE_PAGE_SIZE, 1), 100);
  const decoded = decodeCursor(cursor);
  if (cursor && !decoded) throw new Error("INVALID_CURSOR");
  const rows = await db.message.findMany({
    where: {
      conversationId,
      ...(decoded ? {
        OR: [
          { createdAt: { lt: decoded.createdAt } },
          { createdAt: decoded.createdAt, id: { lt: decoded.id } },
        ],
      } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      ciphertext: true,
      createdAt: true,
      editedAt: true,
      deletedAt: true,
      sender: { select: { username: true } },
      receipts: { where: { userId: { not: userId } }, select: { status: true, updatedAt: true } },
    },
  });
  const hasMore = rows.length > limit;
  const page = (hasMore ? rows.slice(0, limit) : rows).reverse();
  return {
    messages: page.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderUsername: message.sender.username ?? "Anonymous",
      text: message.deletedAt ? "Message deleted" : decryptMessage(message.ciphertext),
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt,
      deliveryStatus: message.senderId === userId ? (message.receipts[0]?.status ?? MessageStatus.SENT) : null,
    })),
    nextCursor: hasMore ? encodeCursor(page[0].createdAt, page[0].id) : null,
  };
}

async function getConversationPeer(userId: string, conversationId: string) {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, status: "ACTIVE", members: { some: { userId, leftAt: null } } },
    select: { members: { where: { leftAt: null }, select: { userId: true, user: { select: { username: true, status: true } } } } },
  });
  if (!conversation) throw new Error("CONVERSATION_FORBIDDEN");
  const peer = conversation.members.find((m) => m.userId !== userId);
  if (!peer || peer.user.status !== "ACTIVE") throw new Error("CONVERSATION_UNAVAILABLE");
  return peer;
}

async function assertNotBlocked(userId: string, peerId: string) {
  const block = await db.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedUserId: peerId },
        { blockerId: peerId, blockedUserId: userId },
      ],
    },
    select: { blockerId: true },
  });
  if (block) throw new Error("USER_BLOCKED");
}

export async function createMessage(userId: string, conversationId: string, plaintext: string, clientMessageId: string) {
  const trimmed = plaintext.trim();
  if (!trimmed || trimmed.length > MESSAGE_MAX_LENGTH || !/^[0-9a-f-]{36}$/i.test(clientMessageId)) throw new Error("INVALID_MESSAGE");
  const membership = await requireMembership(userId, conversationId);
  const peer = await getConversationPeer(userId, conversationId);
  await assertNotBlocked(userId, peer.userId);

  const existing = await db.message.findFirst({
    where: { senderId: userId, clientMessageId },
    select: { id: true, conversationId: true, senderId: true, ciphertext: true, createdAt: true, editedAt: true, deletedAt: true, sender: { select: { username: true } }, receipts: { where: { userId: peer.userId }, select: { status: true } } },
  });
  if (existing) {
    if (existing.conversationId !== conversationId) throw new Error("INVALID_MESSAGE");
    return {
      message: {
        id: existing.id, conversationId: existing.conversationId, senderId: existing.senderId, senderUsername: existing.sender.username ?? "Anonymous", text: existing.deletedAt ? "Message deleted" : decryptMessage(existing.ciphertext), createdAt: existing.createdAt, editedAt: existing.editedAt, deletedAt: existing.deletedAt, deliveryStatus: existing.receipts[0]?.status ?? MessageStatus.SENT,
      },
      peerId: peer.userId,
    };
  }

  const message = await db.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { conversationId, senderId: userId, clientMessageId, ciphertext: encryptMessage(trimmed) },
      select: { id: true, conversationId: true, senderId: true, ciphertext: true, createdAt: true, editedAt: true, deletedAt: true, sender: { select: { username: true } } },
    });
    await tx.messageReceipt.create({ data: { messageId: created.id, userId: peer.userId, status: MessageStatus.SENT } });
    // A conversation hidden by a user reappears when a new message arrives.
    // A blocked peer cannot reach this transaction because assertNotBlocked runs above.
    await tx.conversationMember.updateMany({
      where: { conversationId, userId: peer.userId, leftAt: null, hiddenAt: { not: null } },
      data: { hiddenAt: null },
    });
    await tx.conversation.update({ where: { id: membership.conversationId }, data: { updatedAt: created.createdAt } });
    return created;
  });
  return {
    message: {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderUsername: message.sender.username ?? "Anonymous",
      text: trimmed,
      createdAt: message.createdAt,
      editedAt: message.editedAt,
      deletedAt: message.deletedAt,
      deliveryStatus: MessageStatus.SENT,
    },
    peerId: peer.userId,
  };
}

export async function markConversationDelivered(userId: string, conversationId: string) {
  const membership = await requireMembership(userId, conversationId);
  const peer = await getConversationPeer(userId, conversationId);
  await assertNotBlocked(userId, peer.userId);
  const candidates = await db.messageReceipt.findMany({
    where: { userId, status: MessageStatus.SENT, message: { conversationId, senderId: peer.userId } },
    orderBy: { updatedAt: "asc" },
    take: 500,
    select: { messageId: true },
  });
  if (candidates.length) {
    await db.messageReceipt.updateMany({ where: { userId, messageId: { in: candidates.map((row) => row.messageId) }, status: MessageStatus.SENT }, data: { status: MessageStatus.DELIVERED } });
  }
  return { messageIds: candidates.map((row) => row.messageId), peerId: peer.userId, conversationId: membership.conversationId };
}

export async function markConversationRead(userId: string, conversationId: string, messageId: string) {
  await requireMembership(userId, conversationId);
  const target = await db.message.findFirst({ where: { id: messageId, conversationId }, select: { id: true, senderId: true, createdAt: true } });
  if (!target) throw new Error("MESSAGE_NOT_FOUND");
  await assertNotBlocked(userId, target.senderId);
  if (target.senderId === userId) return { messageIds: [], peerId: target.senderId };
  const unread = await db.message.findMany({
    where: { conversationId, senderId: { not: userId }, createdAt: { lte: target.createdAt }, receipts: { some: { userId, status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED] } } } },
    select: { id: true },
    take: 500,
  });
  const ids = unread.map((row) => row.id);
  if (ids.length) await db.messageReceipt.updateMany({ where: { userId, messageId: { in: ids }, status: { in: [MessageStatus.SENT, MessageStatus.DELIVERED] } }, data: { status: MessageStatus.READ } });
  await db.conversationMember.update({ where: { conversationId_userId: { conversationId, userId } }, data: { lastReadMessageId: target.id } });
  return { messageIds: ids, peerId: target.senderId };
}

export async function markMessageDeleted(userId: string, conversationId: string, messageId: string) {
  await requireMembership(userId, conversationId);
  const peer = await getConversationPeer(userId, conversationId);
  await assertNotBlocked(userId, peer.userId);
  const updated = await db.message.updateMany({
    where: { id: messageId, conversationId, senderId: userId, deletedAt: null },
    data: { deletedAt: new Date(), ciphertext: encryptMessage("[deleted]") },
  });
  if (updated.count !== 1) throw new Error("MESSAGE_NOT_FOUND");
  return { messageId };
}
