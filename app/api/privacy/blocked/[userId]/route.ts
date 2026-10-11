import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { isUuid } from "@/lib/validation";
import { assertSameOrigin } from "@/server/csrf";
import { db } from "@/server/db";
import { getRequestId, jsonError } from "@/server/http";
import { allowRateLimit, rateLimitHeaders } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  try {
    await assertSameOrigin();
    const rateKey = `privacy:unblock:${user.id}`;
    if (!allowRateLimit(rateKey, 30, 60 * 1000)) return jsonError("Too many requests. Please try again later.", 429, requestId, rateLimitHeaders(rateKey));
    const { userId: blockedUserId } = await params;
    if (!isUuid(blockedUserId) || blockedUserId === user.id) return jsonError("Blocked user unavailable.", 404, requestId);
    const memberships = await db.conversationMember.findMany({
      where: {
        userId: user.id,
        hiddenAt: { not: null },
        conversation: { members: { some: { userId: blockedUserId, leftAt: null } } },
      },
      select: { conversationId: true },
    });
    await db.$transaction(async (tx) => {
      await tx.blockedUser.deleteMany({ where: { blockerId: user.id, blockedUserId } });
      if (memberships.length) {
        await tx.conversationMember.updateMany({
          where: { userId: user.id, conversationId: { in: memberships.map((row) => row.conversationId) }, hiddenAt: { not: null }, leftAt: null },
          data: { hiddenAt: null },
        });
      }
      await tx.securityEvent.create({ data: { userId: user.id, type: "USER_UNBLOCKED", outcome: "SUCCESS", requestId } });
    });
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    if (error instanceof Error && error.message === "CSRF_ORIGIN_MISMATCH") return jsonError("Request origin is not allowed.", 403, requestId);
    return jsonError("Unable to unblock this user.", 500, requestId);
  }
}
