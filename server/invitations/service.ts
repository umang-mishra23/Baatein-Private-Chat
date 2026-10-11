import { randomUUID } from "node:crypto";
import { InvitationStatus, SmsDeliveryStatus } from "@/generated/prisma/client";
import { decryptMessage, decryptSensitive, encryptMessage, encryptSensitive, hashInviteToken, hashPhoneLookup, hashSessionToken, hashUserAgent, randomToken } from "@/lib/security";
import { db } from "@/server/db";
import { normalizePhone } from "@/server/normalization";
import { getSmsProvider } from "@/server/sms/provider";
import { getCurrentSessionToken, getSessionRecord, sessionExpiresAt, setSessionCookie } from "@/server/auth/session";
import { normalizeUsername } from "@/server/auth/identity";
import { usernameSchema } from "@/lib/validation";

const INVITATION_TTL_HOURS = positiveNumber(process.env.INVITATION_TTL_HOURS, 24);
const INVITATION_RESEND_COOLDOWN_SECONDS = positiveNumber(process.env.INVITATION_RESEND_COOLDOWN_SECONDS, 60);
const MAX_RESENDS = 3;

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function invitationExpiresAt(from = Date.now()) {
  return new Date(from + INVITATION_TTL_HOURS * 60 * 60 * 1000);
}

function buildInviteUrl(rawToken: string) {
  const base = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  base.pathname = `${base.pathname.replace(/\/$/, "")}/invite/${rawToken}`;
  base.search = "";
  base.hash = "";
  return base.toString();
}

function invitationSmsBody(
  rawToken: string,
  firstMessage?: string
) {
  const message =
    firstMessage?.trim() ||
    "Someone wants to start a private chat with you.";

  const invitationUrl = buildInviteUrl(rawToken).trim();

  return `${message}

Join the private chat using this secure link:
${invitationUrl}`;
}

function genericInvitationError() {
  return new Error("UNABLE_TO_PROCESS_INVITATION");
}

export async function createInvitation(input: {
  senderId: string;
  recipientPhoneInput: string;
  firstMessage?: string;
}) {
  const phone = normalizePhone(input.recipientPhoneInput);
  const lookupHash = hashPhoneLookup(phone);
  const existing = await db.invitation.findFirst({
    where: {
      senderId: input.senderId,
      recipientLookupHash: lookupHash,
      status: InvitationStatus.PENDING,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { lastSentAt: true, createdAt: true },
  });

  if (existing?.lastSentAt && Date.now() - existing.lastSentAt.getTime() < INVITATION_RESEND_COOLDOWN_SECONDS * 1000) {
    throw new Error("INVITATION_COOLDOWN");
  }

  const rawToken = randomToken(32);
  const tokenHash = hashInviteToken(rawToken);
  const firstMessage = input.firstMessage?.trim() || undefined;
  const invitation = await db.invitation.create({
    data: {
      tokenHash,
      senderId: input.senderId,
      recipientLookupHash: lookupHash,
      recipientPhoneEncrypted: encryptSensitive(phone),
      initialMessageCiphertext: firstMessage ? encryptMessage(firstMessage) : undefined,
      status: InvitationStatus.PENDING,
      smsDeliveryStatus: SmsDeliveryStatus.PENDING,
      lastSentAt: new Date(),
      expiresAt: invitationExpiresAt(),
    },
    select: { id: true, expiresAt: true, lastSentAt: true },
  });

  try {
    const delivery = await getSmsProvider().send({ to: phone, body: invitationSmsBody(rawToken, firstMessage) });
    await db.invitation.update({
      where: { id: invitation.id },
      data: {
        smsDeliveryStatus: SmsDeliveryStatus.SENT,
        smsProviderMessageId: delivery.providerMessageId,
      },
    });
  } catch {
    await db.invitation.update({
      where: { id: invitation.id },
      data: { smsDeliveryStatus: SmsDeliveryStatus.FAILED },
    });
    throw genericInvitationError();
  }

  return { id: invitation.id, expiresAt: invitation.expiresAt, status: InvitationStatus.PENDING };
}

export async function listSenderInvitations(senderId: string) {
  const now = new Date();
  await db.invitation.updateMany({
    where: { senderId, status: InvitationStatus.PENDING, expiresAt: { lte: now } },
    data: { status: InvitationStatus.EXPIRED, recipientPhoneEncrypted: null },
  });

  return db.invitation.findMany({
    where: { senderId, status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED, InvitationStatus.CANCELLED, InvitationStatus.EXPIRED] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      smsDeliveryStatus: true,
      createdAt: true,
      expiresAt: true,
      usedAt: true,
      cancelledAt: true,
      lastSentAt: true,
      resendCount: true,
    },
  });
}

export async function getInvitationPreview(rawToken: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return { state: "invalid" as const };

  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashInviteToken(rawToken) },
    select: { status: true, expiresAt: true, usedAt: true, cancelledAt: true },
  });

  if (!invitation) return { state: "invalid" as const };
  if (invitation.status === InvitationStatus.ACCEPTED || invitation.usedAt) return { state: "used" as const };
  if (invitation.status === InvitationStatus.CANCELLED || invitation.cancelledAt) return { state: "cancelled" as const };
  if (invitation.expiresAt <= new Date()) {
    await db.invitation.updateMany({
      where: { tokenHash: hashInviteToken(rawToken), status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.EXPIRED, recipientPhoneEncrypted: null },
    });
    return { state: "expired" as const };
  }
  if (invitation.status !== InvitationStatus.PENDING) return { state: "invalid" as const };
  return { state: "valid" as const, expiresAt: invitation.expiresAt };
}

export async function cancelInvitation(senderId: string, invitationId: string) {
  const updated = await db.invitation.updateMany({
    where: {
      id: invitationId,
      senderId,
      status: InvitationStatus.PENDING,
      usedAt: null,
      cancelledAt: null,
    },
    data: { status: InvitationStatus.CANCELLED, cancelledAt: new Date(), recipientPhoneEncrypted: null },
  });
  if (updated.count !== 1) throw genericInvitationError();
}

export async function resendInvitation(senderId: string, invitationId: string) {
  const now = new Date();
  const invitation = await db.invitation.findFirst({
    where: { id: invitationId, senderId, status: InvitationStatus.PENDING, expiresAt: { gt: now } },
    select: {
      id: true,
      recipientPhoneEncrypted: true,
      expiresAt: true,
      lastSentAt: true,
      resendCount: true,
      initialMessageCiphertext: true,
    },
  });

  if (!invitation) throw genericInvitationError();
  if (invitation.lastSentAt && now.getTime() - invitation.lastSentAt.getTime() < INVITATION_RESEND_COOLDOWN_SECONDS * 1000) {
    throw new Error("INVITATION_COOLDOWN");
  }
  if (invitation.resendCount >= MAX_RESENDS) throw new Error("RESEND_LIMIT_REACHED");

  const rawToken = randomToken(32);
  const tokenHash = hashInviteToken(rawToken);
  if (!invitation.recipientPhoneEncrypted) throw genericInvitationError();
  const recipientPhone = decryptSensitive(invitation.recipientPhoneEncrypted);

  await db.invitation.update({
    where: { id: invitation.id },
    data: {
      tokenHash,
      lastSentAt: now,
      resendCount: { increment: 1 },
      smsDeliveryStatus: SmsDeliveryStatus.PENDING,
      smsProviderMessageId: null,
    },
  });

  try {
    const firstMessage = invitation.initialMessageCiphertext
      ? decryptMessage(invitation.initialMessageCiphertext)
      : undefined;
    const delivery = await getSmsProvider().send({ to: recipientPhone, body: invitationSmsBody(rawToken, firstMessage) });
    await db.invitation.update({
      where: { id: invitation.id },
      data: { smsDeliveryStatus: SmsDeliveryStatus.SENT, smsProviderMessageId: delivery.providerMessageId },
    });
  } catch {
    await db.invitation.update({
      where: { id: invitation.id },
      data: { smsDeliveryStatus: SmsDeliveryStatus.FAILED },
    });
    throw genericInvitationError();
  }

  return { id: invitation.id, expiresAt: invitation.expiresAt, status: InvitationStatus.PENDING };
}

export async function acceptInvitation(rawToken: string, requestedUsername: string, userAgent?: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(rawToken)) throw new Error("INVALID_INVITATION");
  const parsedUsername = usernameSchema.safeParse(requestedUsername);
  if (!parsedUsername.success) throw new Error("INVALID_USERNAME");
  const displayName = parsedUsername.data;
  const usernameNormalized = normalizeUsername(displayName);
  const currentSession = await getSessionRecord();
  const currentUserId = currentSession?.userId ?? null;
  if (currentUserId && currentSession.user.username && normalizeUsername(currentSession.user.username) !== usernameNormalized) {
    throw new Error("USERNAME_ALREADY_SET");
  }

  const currentToken = await getCurrentSessionToken();
  const newSessionToken = randomToken(32);
  const newSessionHash = hashSessionToken(newSessionToken);
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const invite = await tx.invitation.findUnique({
      where: { tokenHash: hashInviteToken(rawToken) },
      select: {
        id: true,
        senderId: true,
        status: true,
        expiresAt: true,
        usedAt: true,
        cancelledAt: true,
        initialMessageCiphertext: true,
      },
    });

    if (!invite || invite.status !== InvitationStatus.PENDING || invite.usedAt || invite.cancelledAt || invite.expiresAt <= now) {
      if (invite?.status === InvitationStatus.PENDING && invite.expiresAt <= now) {
        await tx.invitation.updateMany({ where: { id: invite.id, status: InvitationStatus.PENDING }, data: { status: InvitationStatus.EXPIRED, recipientPhoneEncrypted: null } });
      }
      throw new Error("INVALID_INVITATION");
    }
    if (currentUserId && invite.senderId === currentUserId) throw new Error("SELF_INVITATION");

    const consumed = await tx.invitation.updateMany({
      where: {
        id: invite.id,
        status: InvitationStatus.PENDING,
        usedAt: null,
        cancelledAt: null,
        expiresAt: { gt: now },
      },
      data: { status: InvitationStatus.ACCEPTED, usedAt: now },
    });
    if (consumed.count !== 1) throw new Error("INVALID_INVITATION");

    let recipient;
    if (currentUserId) {
      recipient = await tx.user.findUnique({ where: { id: currentUserId }, select: { id: true, username: true, status: true } });
      if (!recipient || recipient.status !== "ACTIVE") throw new Error("UNAUTHENTICATED");
      if (!recipient.username) {
        try {
          recipient = await tx.user.update({
            where: { id: currentUserId },
            data: { username: displayName, usernameNormalized },
            select: { id: true, username: true, status: true },
          });
        } catch (error) {
          if (isUniqueViolation(error)) throw new Error("USERNAME_UNAVAILABLE");
          throw error;
        }
      }
    } else {
      try {
        recipient = await tx.user.create({
          data: { username: displayName, usernameNormalized },
          select: { id: true, username: true, status: true },
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new Error("USERNAME_UNAVAILABLE");
        throw error;
      }
    }

    const conversation = await tx.conversation.create({ data: { createdById: invite.senderId } });
    await tx.conversationMember.createMany({
      data: [
        { conversationId: conversation.id, userId: invite.senderId },
        { conversationId: conversation.id, userId: recipient.id },
      ],
    });

    if (invite.initialMessageCiphertext) {
      const initialMessage = await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: invite.senderId,
          clientMessageId: randomUUID(),
          ciphertext: invite.initialMessageCiphertext,
        },
        select: { id: true },
      });
      await tx.messageReceipt.create({ data: { messageId: initialMessage.id, userId: recipient.id, status: "SENT" } });
    }

    await tx.invitation.update({ where: { id: invite.id }, data: { conversationId: conversation.id, recipientPhoneEncrypted: null, initialMessageCiphertext: null } });

    if (currentToken && currentUserId) {
      await tx.session.updateMany({
        where: { idHash: hashSessionToken(currentToken), userId: currentUserId, revokedAt: null },
        data: { revokedAt: now },
      });
    }

    await tx.session.create({
      data: {
        idHash: newSessionHash,
        userId: recipient.id,
        expiresAt: sessionExpiresAt(),
        userAgentHash: userAgent ? hashUserAgent(userAgent) : undefined,
      },
    });

    return { conversationId: conversation.id, recipientUsername: recipient.username };
  });

  await setSessionCookie(newSessionToken);
  return result;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

export { INVITATION_RESEND_COOLDOWN_SECONDS };
