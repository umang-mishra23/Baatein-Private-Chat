import { cookies } from "next/headers";
import { hashSessionToken, hashUserAgent, randomToken } from "@/lib/security";
import { db } from "@/server/db";

export const SESSION_COOKIE = "pc_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

type SafeUser = {
  id: string;
  username: string | null;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  createdAt: Date;
};

export function sessionExpiresAt() {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

export async function getCurrentSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function createSession(userId: string, userAgent?: string) {
  const token = randomToken(32);
  await db.session.create({
    data: {
      idHash: hashSessionToken(token),
      userId,
      expiresAt: sessionExpiresAt(),
      userAgentHash: userAgent ? hashUserAgent(userAgent) : undefined,
    },
  });
  await setSessionCookie(token);
  return token;
}

export async function getSessionRecord() {
  const token = await getCurrentSessionToken();
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { idHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== "ACTIVE") return null;

  if (Date.now() - session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { idHash: session.idHash }, data: { lastSeenAt: new Date() } });
  }

  return session;
}

export async function getSessionUser(): Promise<SafeUser | null> {
  const session = await getSessionRecord();
  if (!session) return null;
  return {
    id: session.user.id,
    username: session.user.username,
    status: session.user.status,
    createdAt: session.user.createdAt,
  };
}

export async function requireSessionUser(): Promise<SafeUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function rotateCurrentSession(userId: string, userAgent?: string) {
  const jar = await cookies();
  const oldToken = jar.get(SESSION_COOKIE)?.value;
  const newToken = randomToken(32);

  await db.$transaction(async (tx) => {
    if (oldToken) {
      await tx.session.updateMany({
        where: { idHash: hashSessionToken(oldToken), userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await tx.session.create({
      data: {
        idHash: hashSessionToken(newToken),
        userId,
        expiresAt: sessionExpiresAt(),
        userAgentHash: userAgent ? hashUserAgent(userAgent) : undefined,
      },
    });
  });

  await setSessionCookie(newToken);
}

export async function revokeCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return;

  await db.session.updateMany({
    where: { idHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  jar.delete(SESSION_COOKIE);
}
