import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { isUuid } from "@/lib/validation";
import { assertSameOrigin } from "@/server/csrf";
import { db } from "@/server/db";
import { getRequestId, jsonError } from "@/server/http";
import { allowRateLimit, rateLimitHeaders } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  try {
    await assertSameOrigin();
    const rateKey = `conversation:hide:${user.id}`;
    if (!allowRateLimit(rateKey, 30, 60 * 60 * 1000)) return jsonError("Too many requests. Please try again later.", 429, requestId, rateLimitHeaders(rateKey));
    const { conversationId } = await params;
    if (!isUuid(conversationId)) return jsonError("Conversation unavailable.", 404, requestId);
    const membership = await db.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      select: { leftAt: true, conversation: { select: { status: true } } },
    });
    if (!membership || membership.leftAt || membership.conversation.status !== "ACTIVE") return jsonError("Conversation unavailable.", 404, requestId);
    await db.$transaction(async (tx) => {
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: user.id } },
        data: { hiddenAt: new Date() },
      });
      await tx.securityEvent.create({ data: { userId: user.id, type: "CONVERSATION_HIDDEN", outcome: "SUCCESS", requestId } });
    });
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    if (error instanceof Error && error.message === "CSRF_ORIGIN_MISMATCH") return jsonError("Request origin is not allowed.", 403, requestId);
    return jsonError("Unable to delete this conversation.", 500, requestId);
  }
}
