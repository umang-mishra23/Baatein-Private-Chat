import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

export function getRequestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function getRequestId(request: NextRequest) {
  return request.headers.get("x-request-id")?.slice(0, 64) || randomUUID();
}

export function jsonError(message: string, status: number, requestId?: string, headers?: HeadersInit) {
  const response = NextResponse.json({ error: message, requestId }, { status, headers });
  if (requestId) response.headers.set("x-request-id", requestId);
  return response;
}
