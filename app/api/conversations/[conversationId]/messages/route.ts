import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { createMessage, listMessages, MESSAGE_MAX_LENGTH } from "@/server/conversations/service";
import { assertSameOrigin } from "@/server/csrf";
import { messageSchema } from "@/lib/validation";
import { getRequestId, jsonError } from "@/server/http";
import { allowRateLimit, rateLimitHeaders } from "@/server/rate-limit";
import { hashIp } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  const { conversationId } = await params;
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const parsedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 40);
  try {
    const result = await listMessages(user.id, conversationId, cursor, Number.isFinite(parsedLimit) ? parsedLimit : 40);
    return NextResponse.json(result, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    if (error instanceof Error && error.message === "CONVERSATION_FORBIDDEN") return jsonError("Conversation unavailable.", 404, requestId);
    if (error instanceof Error && error.message === "INVALID_CURSOR") return jsonError("Invalid message cursor.", 400, requestId);
    return jsonError("Unable to load messages.", 500, requestId);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  try {
    await assertSameOrigin();
    const key = `message:send:${user.id}:${hashIp(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown")}`;
    if (!allowRateLimit(key, 120, 60 * 1000)) return jsonError("Too many messages. Please slow down.", 429, requestId, rateLimitHeaders(key));
    const body = await request.json() as { text?: unknown; clientMessageId?: unknown };
    const parsed = messageSchema.safeParse({ text: body.text, clientMessageId: body.clientMessageId });
    if (!parsed.success) return jsonError(`Message must be between 1 and ${MESSAGE_MAX_LENGTH} characters.`, 400, requestId);
    const { conversationId } = await params;
    const result = await createMessage(user.id, conversationId, parsed.data.text, parsed.data.clientMessageId ?? randomUUID());
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    if (!(error instanceof Error)) return jsonError("Unable to send message.", 400, requestId);
    if (error.message === "CONVERSATION_FORBIDDEN" || error.message === "CONVERSATION_UNAVAILABLE") return jsonError("Conversation unavailable.", 404, requestId);
    if (error.message === "USER_BLOCKED") return jsonError("This conversation is unavailable.", 403, requestId);
    if (error.message === "INVALID_MESSAGE") return jsonError(`Message must be between 1 and ${MESSAGE_MAX_LENGTH} characters.`, 400, requestId);
    return jsonError("Unable to send message.", 500, requestId);
  }
}
