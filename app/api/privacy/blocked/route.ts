import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getRequestId, jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  try {
    const rows = await db.blockedUser.findMany({
      where: { blockerId: user.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        blockedUserId: true,
        createdAt: true,
        blockedUser: { select: { username: true, status: true } },
      },
    });
    return NextResponse.json({ blockedUsers: rows.map((row) => ({
      id: row.blockedUserId,
      username: row.blockedUser.status === "ACTIVE" ? row.blockedUser.username ?? "Anonymous" : "Deleted identity",
      createdAt: row.createdAt,
    })) }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch {
    return jsonError("Unable to load blocked users.", 500, requestId);
  }
}
