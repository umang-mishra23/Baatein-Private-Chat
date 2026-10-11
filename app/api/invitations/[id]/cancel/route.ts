import { NextRequest } from "next/server";
import { assertSameOrigin } from "@/server/csrf";
import { getRequestId, jsonError } from "@/server/http";
import { requireSessionUser } from "@/server/auth/session";
import { cancelInvitation } from "@/server/invitations/service";
import { isUuid } from "@/lib/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request);
  try {
    await assertSameOrigin();
    const user = await requireSessionUser();
    const { id } = await params;
    if (!isUuid(id)) return jsonError("Unable to process this invitation.", 400, requestId);
    await cancelInvitation(user.id, id);
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return jsonError("Unauthorized", 401, requestId);
    return jsonError("Unable to process this invitation.", 400, requestId);
  }
}
