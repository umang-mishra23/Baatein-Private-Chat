import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { createAnonymousIdentity } from "@/server/auth/identity";
import { getRequestIp, getRequestId, jsonError } from "@/server/http";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const existing = await getSessionUser();
    if (existing) {
      return NextResponse.json({ user: { id: existing.id, username: existing.username } }, { headers: { "x-request-id": requestId } });
    }

    const user = await createAnonymousIdentity({
      ip: getRequestIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json(
      { user: { id: user.id, username: user.username } },
      { status: 201, headers: { "x-request-id": requestId, "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") return jsonError("Too many attempts. Please try again later.", 429, requestId, { "Retry-After": "3600" });
    return jsonError("Unable to start a private session.", 500, requestId);
  }
}
