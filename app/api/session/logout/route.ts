import { NextRequest, NextResponse } from "next/server";
import { revokeCurrentSession } from "@/server/auth/session";
import { getRequestId, jsonError } from "@/server/http";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    await revokeCurrentSession();
    return NextResponse.json({ ok: true }, { headers: { "x-request-id": requestId, "cache-control": "no-store" } });
  } catch {
    return jsonError("Unable to end the current session.", 500, requestId);
  }
}
