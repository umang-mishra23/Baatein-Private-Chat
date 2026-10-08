import { NextRequest, NextResponse } from "next/server";
import { acceptInvitation } from "@/server/invitations/service";
import { assertSameOrigin } from "@/server/csrf";
import { hashIp } from "@/lib/security";
import { getRequestId, getRequestIp, jsonError } from "@/server/http";
import { allowRateLimit, rateLimitHeaders } from "@/server/rate-limit";
import { usernameSchema } from "@/lib/validation";
import { securityLog } from "@/server/logger";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const ipHash = hashIp(getRequestIp(request));
  const key = `invite:accept:${ipHash}`;
  try {
    await assertSameOrigin();
    if (!allowRateLimit(key, 20, 60 * 60 * 1000)) return jsonError("Too many attempts. Please try again later.", 429, requestId, rateLimitHeaders(key));

    const body = await request.json() as { token?: unknown; username?: unknown };
    if (typeof body.token !== "string" || typeof body.username !== "string") return jsonError("Unable to accept this invitation.", 400, requestId);
    if (!/^[A-Za-z0-9_-]{43}$/.test(body.token)) return jsonError("Invitation unavailable.", 404, requestId);
    const parsed = usernameSchema.safeParse(body.username);
    if (!parsed.success) return jsonError("Choose a valid username.", 400, requestId);

    const result = await acceptInvitation(body.token, parsed.data, request.headers.get("user-agent") ?? undefined);
    securityLog({ type: "invitation_accepted", outcome: "success", ipHash });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
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
