import { NextRequest, NextResponse } from "next/server";
import { inviteRequestSchema } from "@/lib/validation";
import { hashIp, hashPhoneLookup } from "@/lib/security";
import { getRequestId, getRequestIp, jsonError, jsonBodyErrorResponse, readJsonBody } from "@/server/http";
import { assertSameOrigin } from "@/server/csrf";
import { requireSessionUser } from "@/server/auth/session";
import { createInvitation, listSenderInvitations } from "@/server/invitations/service";
import { allowRateLimit, rateLimitHeaders } from "@/server/rate-limit";
import { securityLog } from "@/server/logger";
import { normalizePhone } from "@/server/normalization";

export async function GET() {
  try {
    const user = await requireSessionUser();
    const invitations = await listSenderInvitations(user.id);
    return NextResponse.json({ invitations }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    await assertSameOrigin();
    const user = await requireSessionUser();
    const ip = getRequestIp(request);
    const ipHash = hashIp(ip);

    if (!allowRateLimit(`invite:user:${user.id}`, Number(process.env.INVITATION_RATE_LIMIT_PER_HOUR ?? 5), 60 * 60 * 1000)) {
      return jsonError("Too many invitations. Please try again later.", 429, requestId, rateLimitHeaders(`invite:user:${user.id}`));
    }
    if (!allowRateLimit(`invite:ip:${ipHash}`, 20, 60 * 60 * 1000)) {
      return jsonError("Too many invitations. Please try again later.", 429, requestId, rateLimitHeaders(`invite:ip:${ipHash}`));
    }

    const parsed = inviteRequestSchema.safeParse(await readJsonBody(request, 8 * 1024));
    if (!parsed.success) return jsonError("Unable to process this invitation.", 400, requestId);

    const normalizedPhone = normalizePhone(parsed.data.recipientPhone);
    const result = await createInvitation({
      senderId: user.id,
      recipientPhoneInput: normalizedPhone,
      firstMessage: parsed.data.firstMessage,
    });

    securityLog({ type: "invitation_created", outcome: "success", userId: user.id, ipHash, metadata: { recipientHash: hashPhoneLookup(normalizedPhone) } });
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const bodyError = jsonBodyErrorResponse(error, requestId);
    if (bodyError) return bodyError;
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return jsonError("Unauthorized", 401, requestId);
    if (error instanceof Error && error.message === "INVITATION_COOLDOWN") return jsonError("Please wait before sending another invitation.", 429, requestId);
    securityLog({ type: "invitation_created", outcome: "failure" });
    return jsonError("Unable to process this invitation.", 400, requestId);
  }
}
