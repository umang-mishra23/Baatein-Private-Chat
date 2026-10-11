import { NextRequest, NextResponse } from "next/server";
import { acceptInvitation } from "@/server/invitations/service";
import { assertSameOrigin } from "@/server/csrf";
import { hashIp } from "@/lib/security";
import { getRequestId, getRequestIp, jsonError, jsonBodyErrorResponse, readJsonBody } from "@/server/http";
import { allowRateLimit, rateLimitHeaders } from "@/server/rate-limit";
import { invitationAcceptSchema } from "@/lib/validation";
import { securityLog } from "@/server/logger";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ipHash = hashIp(getRequestIp(request));
  const key = `invite:accept:${ipHash}`;
  try {
    await assertSameOrigin();
    if (!allowRateLimit(key, 20, 60 * 60 * 1000)) return jsonError("Too many attempts. Please try again later.", 429, requestId, rateLimitHeaders(key));

    const parsed = invitationAcceptSchema.safeParse(await readJsonBody(request, 4 * 1024));
    if (!parsed.success) return jsonError("Unable to accept this invitation.", 400, requestId);

    const result = await acceptInvitation(parsed.data.token, parsed.data.username, request.headers.get("user-agent") ?? undefined);
    securityLog({ type: "invitation_accepted", outcome: "success", ipHash });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const bodyError = jsonBodyErrorResponse(error, requestId);
    if (bodyError) return bodyError;
    if (error instanceof Error && error.message === "CSRF_ORIGIN_MISMATCH") return jsonError("Request origin is not allowed.", 403, requestId);
    if (!(error instanceof Error)) return jsonError("Invitation unavailable.", 404, requestId);
    switch (error.message) {
      case "INVALID_INVITATION": return jsonError("Invitation unavailable.", 404, requestId);
      case "SELF_INVITATION": return jsonError("This invitation cannot be accepted here.", 409, requestId);
      case "USERNAME_UNAVAILABLE": return jsonError("That username is already in use.", 409, requestId);
      case "USERNAME_ALREADY_SET": return jsonError("This private identity already has a different username.", 409, requestId);
      case "UNAUTHENTICATED": return jsonError("Session unavailable. Please try again.", 401, requestId);
      default: return jsonError("Unable to accept this invitation.", 400, requestId);
    }
  }
}
