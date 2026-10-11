import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";

export function getRequestIp(request: NextRequest) {
  // Only trust forwarded IP headers when a deployment has explicitly configured
  // its trusted proxy hop count and its edge proxy normalizes the header chain.
  // In development we assume one local/tunnel proxy. Never log this value raw.
  const configuredHops = process.env.TRUSTED_PROXY_HOPS;
  const trustedHops = configuredHops && /^\d+$/.test(configuredHops)
    ? Number(configuredHops)
    : (process.env.NODE_ENV === "production" ? 0 : 2);
  if (trustedHops < 1) return "unknown";

  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return "unknown";
  const chain = forwarded.split(",").map((value) => value.trim()).filter(Boolean);
  if (!chain.length) return "unknown";
  // Select the address immediately before the configured trusted proxy suffix.
  const index = Math.max(0, chain.length - trustedHops);
  const selected = chain[index];
  return selected && isIP(selected) ? selected : "unknown";
}

export function getRequestId(request: NextRequest) {
  const provided = request.headers.get("x-request-id")?.trim();
  return provided && /^[A-Za-z0-9._:-]{1,64}$/.test(provided) ? provided : randomUUID();
}

export function jsonError(message: string, status: number, requestId?: string, headers?: HeadersInit) {
  const response = NextResponse.json({ error: message, requestId }, { status, headers });
  if (requestId) response.headers.set("x-request-id", requestId);
  response.headers.set("cache-control", "no-store");
  return response;
}

export type JsonBodyErrorCode = "UNSUPPORTED_CONTENT_TYPE" | "BODY_TOO_LARGE" | "INVALID_JSON";

export class JsonBodyError extends Error {
  constructor(readonly code: JsonBodyErrorCode) {
    super(code);
    this.name = "JsonBodyError";
  }
}

/** Read JSON with a hard byte limit before parsing, including chunked requests. */
export async function readJsonBody(request: Request, maxBytes = 16 * 1024): Promise<unknown> {
  const contentType = (request.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" && !/^application\/[a-z0-9.+-]+\+json$/.test(contentType)) {
    throw new JsonBodyError("UNSUPPORTED_CONTENT_TYPE");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    throw new JsonBodyError("BODY_TOO_LARGE");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new JsonBodyError("INVALID_JSON");
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new JsonBodyError("BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof JsonBodyError) throw error;
    throw new JsonBodyError("INVALID_JSON");
  }

  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new JsonBodyError("INVALID_JSON");
  }
}

export function jsonBodyErrorResponse(error: unknown, requestId: string) {
  if (!(error instanceof JsonBodyError)) return null;
  if (error.code === "BODY_TOO_LARGE") return jsonError("Request body is too large.", 413, requestId);
  if (error.code === "UNSUPPORTED_CONTENT_TYPE") return jsonError("Content-Type must be application/json.", 415, requestId);
  return jsonError("Invalid JSON request body.", 400, requestId);
}
