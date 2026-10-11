import { NextRequest, NextResponse } from "next/server";
import { revokeCurrentSession } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/csrf";
import { getRequestId, jsonError } from "@/server/http";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    await assertSameOrigin();
    await revokeCurrentSession();
    return NextResponse.json({ ok: true }, { headers: { "x-request-id": requestId, "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "CSRF_ORIGIN_MISMATCH") return jsonError("Request origin is not allowed.", 403, requestId);
    return jsonError("Unable to end the current session.", 500, requestId);
  }
}
