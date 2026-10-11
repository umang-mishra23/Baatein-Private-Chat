import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { markConversationRead } from "@/server/conversations/service";
import { assertSameOrigin } from "@/server/csrf";
import { readReceiptSchema } from "@/lib/validation";
import { getRequestId, jsonError, jsonBodyErrorResponse, readJsonBody } from "@/server/http";
import { allowRateLimit, rateLimitHeaders } from "@/server/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  try {
    await assertSameOrigin();
    const rateKey = `message:read:${user.id}`;
    if (!allowRateLimit(rateKey, 120, 60 * 1000)) return jsonError("Too many requests. Please slow down.", 429, requestId, rateLimitHeaders(rateKey));
    const parsed = readReceiptSchema.safeParse(await readJsonBody(request, 2 * 1024));
    if (!parsed.success) return jsonError("Invalid message.", 400, requestId);
    const { conversationId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(conversationId)) return jsonError("Conversation unavailable.", 404, requestId);
    const result = await markConversationRead(user.id, conversationId, parsed.data.messageId);
    return NextResponse.json(result, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    const bodyError = jsonBodyErrorResponse(error, requestId);
    if (bodyError) return bodyError;
    if (error instanceof Error && error.message === "CSRF_ORIGIN_MISMATCH") return jsonError("Request origin is not allowed.", 403, requestId);
    if (error instanceof Error && error.message === "CONVERSATION_FORBIDDEN") return jsonError("Conversation unavailable.", 404, requestId);
    if (error instanceof Error && error.message === "MESSAGE_NOT_FOUND") return jsonError("Message unavailable.", 404, requestId);
    return jsonError("Unable to update read status.", 500, requestId);
  }
}
