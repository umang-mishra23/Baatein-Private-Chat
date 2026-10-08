import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { markConversationRead } from "@/server/conversations/service";
import { assertSameOrigin } from "@/server/csrf";
import { readReceiptSchema } from "@/lib/validation";
import { getRequestId, jsonError } from "@/server/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  try {
    await assertSameOrigin();
    const body = await request.json() as { messageId?: unknown };
    const parsed = readReceiptSchema.safeParse({ messageId: body.messageId });
    if (!parsed.success) return jsonError("Invalid message.", 400, requestId);
    const { conversationId } = await params;
    const result = await markConversationRead(user.id, conversationId, parsed.data.messageId);
    return NextResponse.json(result, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    if (error instanceof Error && error.message === "CONVERSATION_FORBIDDEN") return jsonError("Conversation unavailable.", 404, requestId);
    if (error instanceof Error && error.message === "MESSAGE_NOT_FOUND") return jsonError("Message unavailable.", 404, requestId);
    return jsonError("Unable to update read status.", 500, requestId);
  }
}
