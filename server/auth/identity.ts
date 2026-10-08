import { db } from "@/server/db";
import { createSession, rotateCurrentSession } from "@/server/auth/session";
import { hashIp } from "@/lib/security";
import { usernameSchema } from "@/lib/validation";
import { allowRateLimit } from "@/server/rate-limit";

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function createAnonymousIdentity(input: { ip: string; userAgent?: string }) {
  const ipHash = hashIp(input.ip);
  const allowed = allowRateLimit(`identity-bootstrap:${ipHash}`, 8, 60 * 60 * 1000);
  if (!allowed) throw new Error("RATE_LIMITED");

  const user = await db.user.create({
    data: {},
    select: { id: true, username: true, status: true, createdAt: true },
  });

  await createSession(user.id, input.userAgent);
  return user;
}

export async function claimUsername(userId: string, username: string, userAgent?: string) {
  const parsed = usernameSchema.safeParse(username);
  if (!parsed.success) throw new Error("INVALID_USERNAME");

  const displayName = parsed.data;
  const usernameNormalized = normalizeUsername(displayName);

  try {
    const user = await db.user.update({
      where: { id: userId },
      data: { username: displayName, usernameNormalized },
      select: { id: true, username: true, status: true, createdAt: true },
    });

    // Rotate when the anonymous identity becomes a named chat identity.
    await rotateCurrentSession(user.id, userAgent);
    return user;
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("USERNAME_UNAVAILABLE");
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}
