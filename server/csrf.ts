import { headers } from "next/headers";

export async function assertSameOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  if (origin && new URL(origin).origin !== appUrl.origin) throw new Error("CSRF_ORIGIN_MISMATCH");
}
