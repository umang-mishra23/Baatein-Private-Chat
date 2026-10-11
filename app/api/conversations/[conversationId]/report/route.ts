import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/csrf";
import { isUuid, reportSchema } from "@/lib/validation";
import { allowRateLimit } from "@/server/rate-limit";
import { db } from "@/server/db";
import { getRequestId, jsonError, jsonBodyErrorResponse, readJsonBody } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  try {
    await assertSameOrigin();
    const key = `report:${user.id}`;
    if (!allowRateLimit(key, 5, 60 * 60 * 1000)) return jsonError("Too many reports. Please try again later.", 429, requestId);
    const parsed = reportSchema.safeParse(await readJsonBody(request, 8 * 1024));
    if (!parsed.success) return jsonError("Choose a valid reason and optional details.", 400, requestId);
    const { conversationId } = await params;
    if (!isUuid(conversationId)) return jsonError("Conversation unavailable.", 404, requestId);
    const membership = await db.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      select: { leftAt: true, conversation: { select: { status: true, members: { where: { leftAt: null }, select: { userId: true, user: { select: { status: true } } } } } } },
    });
    if (!membership || membership.leftAt || membership.conversation.status !== "ACTIVE") return jsonError("Conversation unavailable.", 404, requestId);
    const peer = membership.conversation.members.find((member) => member.userId !== user.id);
    if (!peer) return jsonError("Conversation unavailable.", 404, requestId);
    await db.$transaction(async (tx) => {
      await tx.report.create({ data: {
        reporterId: user.id,
        reportedUserId: peer.userId,
        conversationId,
        reason: parsed.data.reason,
        details: parsed.data.details || null,
      } });
      await tx.securityEvent.create({ data: { userId: user.id, type: "USER_REPORTED", outcome: "SUCCESS", requestId, metadata: { reason: parsed.data.reason } } });
    });
    return NextResponse.json({ ok: true }, { status: 201, headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    const bodyError = jsonBodyErrorResponse(error, requestId);
    if (bodyError) return bodyError;
    if (error instanceof Error && error.message === "CSRF_ORIGIN_MISMATCH") return jsonError("Request origin is not allowed.", 403, requestId);
    return jsonError("Unable to submit this report.", 500, requestId);
  }
}
