import { NextRequest } from "next/server";
import { assertSameOrigin } from "@/server/csrf";
import { getRequestId, jsonError } from "@/server/http";
import { requireSessionUser } from "@/server/auth/session";
import { resendInvitation } from "@/server/invitations/service";
import { isUuid } from "@/lib/validation";
import { rateLimitHeaders, allowRateLimit } from "@/server/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    await assertSameOrigin();
    const user = await requireSessionUser();
    const { id } = await params;
    if (!isUuid(id)) return jsonError("Unable to resend this invitation.", 400, requestId);
    const key = `invite:resend:${user.id}`;
    if (!allowRateLimit(key, 10, 60 * 60 * 1000)) return jsonError("Too many resend attempts. Please try again later.", 429, requestId, rateLimitHeaders(key));
    const result = await resendInvitation(user.id, id);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return jsonError("Unauthorized", 401, requestId);
    if (error instanceof Error && error.message === "INVITATION_COOLDOWN") return jsonError("Please wait before resending this invitation.", 429, requestId);
    if (error instanceof Error && error.message === "RESEND_LIMIT_REACHED") return jsonError("Resend limit reached for this invitation.", 429, requestId);
    return jsonError("Unable to resend this invitation.", 400, requestId);
  }
}
