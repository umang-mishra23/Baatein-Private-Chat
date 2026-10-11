import { NextRequest, NextResponse } from "next/server";
import { getSessionRecord } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/csrf";
import { db } from "@/server/db";
import { getRequestId, jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const current = await getSessionRecord();
  if (!current) return jsonError("Session required.", 401, requestId);
  try {
    const rows = await db.session.findMany({
      where: { userId: current.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" }, take: 30,
      select: { idHash: true, createdAt: true, expiresAt: true, lastSeenAt: true },
    });
    return NextResponse.json({ sessions: rows.map((row) => ({
      isCurrent: row.idHash === current.idHash,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      lastSeenAt: row.lastSeenAt,
    })) }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch {
    return jsonError("Unable to load sessions.", 500, requestId);
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  const current = await getSessionRecord();
  if (!current) return jsonError("Session required.", 401, requestId);
  try {
    await assertSameOrigin();
    const result = await db.session.updateMany({
      where: { userId: current.userId, revokedAt: null, expiresAt: { gt: new Date() }, idHash: { not: current.idHash } },
      data: { revokedAt: new Date() },
    });
    await db.securityEvent.create({ data: { userId: current.userId, type: "OTHER_SESSIONS_REVOKED", outcome: "SUCCESS", requestId, metadata: { count: result.count } } });
    return NextResponse.json({ ok: true, revoked: result.count }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    if (error instanceof Error && error.message === "CSRF_ORIGIN_MISMATCH") return jsonError("Request origin is not allowed.", 403, requestId);
    return jsonError("Unable to revoke other sessions.", 500, requestId);
  }
}
