export type MutationOriginHeaders = {
  origin?: string | null;
  referer?: string | null;
  fetchSite?: string | null;
};

function safeOrigin(value: string | null | undefined): string | null {
  if (!value || value === "null") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Pure policy helper so origin checks can be unit-tested without Next.js request globals. */
export function isAllowedMutationOrigin(
  headers: MutationOriginHeaders,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (headers.fetchSite?.toLowerCase() === "cross-site") return false;

  // Prefer Origin. Only use Referer when Origin isn't sent; never trust a malformed Origin.
  const candidate = headers.origin
    ? safeOrigin(headers.origin)
    : safeOrigin(headers.referer);

  if (!candidate) return false;
  return allowedOrigins.has(candidate);
}

export function buildAllowedOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const values = [env.NEXT_PUBLIC_APP_URL, ...(env.REALTIME_ORIGIN ?? "").split(",")]
    .filter((value): value is string => Boolean(value?.trim()));
  const origins = new Set<string>();

  for (const value of values) {
    const origin = safeOrigin(value.trim());
    if (origin) origins.add(origin);
  }

  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return origins;
}
