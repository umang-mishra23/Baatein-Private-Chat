import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/csrf";
import { getConversationForUser } from "@/server/conversations/service";
import { db } from "@/server/db";
import { getRequestId, jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  try {
    await assertSameOrigin();
    const { conversationId } = await params;
    const conversation = await getConversationForUser(user.id, conversationId);
    if (conversation.peer.id === user.id) return jsonError("Conversation unavailable.", 404, requestId);
    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.blockedUser.upsert({
        where: { blockerId_blockedUserId: { blockerId: user.id, blockedUserId: conversation.peer.id } },
        create: { blockerId: user.id, blockedUserId: conversation.peer.id },
        update: {},
      });
      await tx.conversationMember.updateMany({
        where: { conversationId, userId: user.id, leftAt: null, hiddenAt: null },
        data: { hiddenAt: now },
      });
      await tx.securityEvent.create({ data: { userId: user.id, type: "USER_BLOCKED", outcome: "SUCCESS", requestId } });
    });
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    if (error instanceof Error && (error.message === "CONVERSATION_FORBIDDEN" || error.message === "CONVERSATION_UNAVAILABLE")) return jsonError("Conversation unavailable.", 404, requestId);
    if (error instanceof Error && error.message === "CSRF_ORIGIN_MISMATCH") return jsonError("Request origin is not allowed.", 403, requestId);
    return jsonError("Unable to block this user.", 500, requestId);
  }
}
