import { NextRequest, NextResponse } from "next/server";
import { claimUsername } from "@/server/auth/identity";
import { getSessionUser, revokeCurrentSession } from "@/server/auth/session";
import { usernameUpdateSchema } from "@/lib/validation";
import { getRequestId, jsonError } from "@/server/http";
import { assertSameOrigin } from "@/server/csrf";
import { deleteAnonymousIdentity } from "@/server/privacy/identity";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  return NextResponse.json({ user: { id: user.id, username: user.username } }, { headers: { "x-request-id": requestId, "cache-control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);

  try {
    await assertSameOrigin();
    const body = await request.json();
    const parsed = usernameUpdateSchema.safeParse(body);
    if (!parsed.success) return jsonError("Choose a valid username.", 400, requestId);

    const updated = await claimUsername(user.id, parsed.data.username, request.headers.get("user-agent") ?? undefined);
    return NextResponse.json({ user: { id: updated.id, username: updated.username } }, { headers: { "x-request-id": requestId, "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "USERNAME_UNAVAILABLE") return jsonError("That username is not available.", 409, requestId);
    if (error instanceof Error && error.message === "INVALID_USERNAME") return jsonError("Choose a valid username.", 400, requestId);
    return jsonError("Unable to update your username.", 500, requestId);
  }
}


export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  const user = await getSessionUser();
  if (!user) return jsonError("Session required.", 401, requestId);
  try {
    await assertSameOrigin();
    const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
    if (body?.confirmation !== "DELETE") return jsonError("Type DELETE to confirm identity deletion.", 400, requestId);
    await deleteAnonymousIdentity(user.id);
    await revokeCurrentSession();
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (error) {
    if (error instanceof Error && error.message === "CSRF_ORIGIN_MISMATCH") return jsonError("Request origin is not allowed.", 403, requestId);
    if (error instanceof Error && error.message === "IDENTITY_UNAVAILABLE") return jsonError("Identity unavailable.", 404, requestId);
    return jsonError("Unable to delete this identity.", 500, requestId);
  }
}
