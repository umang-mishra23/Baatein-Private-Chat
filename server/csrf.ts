import { headers } from "next/headers";
import { buildAllowedOrigins, isAllowedMutationOrigin } from "@/server/security/origin-policy";

/**
 * Protect cookie-authenticated mutations against cross-site request forgery.
 * Browser mutations must carry a matching Origin or Referer. Requests without
 * both are rejected deliberately; non-browser callers should use a separate,
 * explicitly authenticated API rather than bypassing this policy.
 */
export async function assertSameOrigin() {
  const requestHeaders = await headers();
  const allowed = buildAllowedOrigins();
  const ok = isAllowedMutationOrigin({
    origin: requestHeaders.get("origin"),
    referer: requestHeaders.get("referer"),
    fetchSite: requestHeaders.get("sec-fetch-site"),
  }, allowed);

  if (!ok) throw new Error("CSRF_ORIGIN_MISMATCH");
}
