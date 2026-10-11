import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { createMessage, listMessages, MESSAGE_MAX_LENGTH } from "@/server/conversations/service";
import { assertSameOrigin } from "@/server/csrf";
import { isUuid, messageSchema } from "@/lib/validation";
import { getRequestId, getRequestIp, jsonError, jsonBodyErrorResponse, readJsonBody } from "@/server/http";
import { allowRateLimit, rateLimitHeaders } from "@/server/rate-limit";
import { hashIp } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  const { conversationId } = await params;
  if (!isUuid(conversationId)) return jsonError("Conversation unavailable.", 404, requestId);
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  if (cursor && cursor.length > 256) return jsonError("Invalid message cursor.", 400, requestId);
  const listKey = `message:list:${user.id}`;
  if (!allowRateLimit(listKey, 180, 60 * 1000)) return jsonError("Too many requests. Please slow down.", 429, requestId, rateLimitHeaders(listKey));
  const parsedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 40);
  try {
    const result = await listMessages(user.id, conversationId, cursor, Number.isFinite(parsedLimit) ? parsedLimit : 40);
    return NextResponse.json(result, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    if (error instanceof Error && (error.message === "CONVERSATION_FORBIDDEN" || error.message === "USER_BLOCKED" || error.message === "CONVERSATION_UNAVAILABLE")) return jsonError("Conversation unavailable.", 404, requestId);
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
    // The per-user limit cannot be bypassed by spoofing forwarded-IP headers.
    const userKey = `message:send:user:${user.id}`;
    if (!allowRateLimit(userKey, 120, 60 * 1000)) return jsonError("Too many messages. Please slow down.", 429, requestId, rateLimitHeaders(userKey));
    const ipKey = `message:send:ip:${hashIp(getRequestIp(request))}`;
    if (!allowRateLimit(ipKey, 300, 60 * 1000)) return jsonError("Too many messages. Please slow down.", 429, requestId, rateLimitHeaders(ipKey));
    const parsed = messageSchema.safeParse(await readJsonBody(request, 24 * 1024));
    if (!parsed.success) return jsonError(`Message must be between 1 and ${MESSAGE_MAX_LENGTH} characters.`, 400, requestId);
    const { conversationId } = await params;
    const result = await createMessage(user.id, conversationId, parsed.data.text, parsed.data.clientMessageId ?? randomUUID());
    return NextResponse.json(result, { status: 201, headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    const bodyError = jsonBodyErrorResponse(error, requestId);
    if (bodyError) return bodyError;
    if (!(error instanceof Error)) return jsonError("Unable to send message.", 400, requestId);
    if (error.message === "CONVERSATION_FORBIDDEN" || error.message === "CONVERSATION_UNAVAILABLE") return jsonError("Conversation unavailable.", 404, requestId);
    if (error.message === "USER_BLOCKED") return jsonError("This conversation is unavailable.", 403, requestId);
    if (error.message === "INVALID_MESSAGE") return jsonError(`Message must be between 1 and ${MESSAGE_MAX_LENGTH} characters.`, 400, requestId);
    return jsonError("Unable to send message.", 500, requestId);
  }
}
