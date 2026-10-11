import { encryptMessage } from "@/lib/security";
import { db } from "@/server/db";

/**
 * Privacy-preserving accountless identity deletion.
 * Chat history/conversations for this identity are deleted for both participants;
 * submitted moderation reports are retained in anonymized form for safety review.
 */
export async function deleteAnonymousIdentity(userId: string) {
  const now = new Date();
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    if (!user || user.status !== "ACTIVE") throw new Error("IDENTITY_UNAVAILABLE");

    const memberships = await tx.conversationMember.findMany({ where: { userId }, select: { conversationId: true } });
    const conversationIds = [...new Set(memberships.map((row) => row.conversationId))];

    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.invitation.updateMany({
      where: conversationIds.length
        ? { OR: [{ senderId: userId }, { conversationId: { in: conversationIds } }] }
        : { senderId: userId },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        recipientPhoneEncrypted: null,
        initialMessageCiphertext: null,
      },
    });

    // Remove the conversations and their message/receipt history, including the
    // associated invite-to-conversation references (set null by the FK).
    if (conversationIds.length) {
      await tx.conversation.deleteMany({ where: { id: { in: conversationIds } } });
    }

    // Defensive cleanup for any orphaned message rows that violate membership invariants.
    await tx.message.updateMany({
      where: { senderId: userId },
      data: { ciphertext: encryptMessage("[deleted]"), deletedAt: now },
    });

    await tx.blockedUser.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedUserId: userId }] } });
    await tx.report.updateMany({ where: { reportedUserId: userId }, data: { reportedUserId: null, conversationId: null } });
    await tx.report.updateMany({ where: { reporterId: userId }, data: { conversationId: null } });
    await tx.securityEvent.updateMany({ where: { userId }, data: { userId: null } });
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "DELETED",
        deletedAt: now,
        username: null,
        usernameNormalized: null,
        avatarUrl: null,
      },
    });
  });
}
