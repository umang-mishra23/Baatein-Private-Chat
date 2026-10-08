import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { listConversations } from "@/server/conversations/service";
import { getRequestId, jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  try {
    const conversations = await listConversations(user.id);
    return NextResponse.json({ conversations }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch {
    return jsonError("Unable to load conversations.", 500, requestId);
  }
}
