type Entry = { count: number; resetAt: number };

// This process-local store is suitable only for single-process development or
// a single instance. Production multi-instance deployments must use Redis or
// another shared, atomic rate-limit store.
const store = new Map<string, Entry>();
const MAX_ENTRIES = 20_000;
let operations = 0;

function pruneExpired(now: number) {
  for (const [key, value] of store) {
    if (value.resetAt <= now) store.delete(key);
  }
}

function evictOldest() {
  const oldest = store.keys().next();
  if (!oldest.done) store.delete(oldest.value);
}

export function allowRateLimit(key: string, limit: number, windowMs: number): boolean {
  if (!key || !Number.isSafeInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) return false;
  const now = Date.now();
  operations += 1;
  if (operations % 128 === 0) pruneExpired(now);

  const current = store.get(key);
  if (current && current.resetAt > now) {
    if (current.count >= limit) return false;
    current.count += 1;
    // Refresh insertion order for a lightweight bounded LRU eviction.
    store.delete(key);
    store.set(key, current);
    return true;
  }
  if (current) store.delete(key);

  if (store.size >= MAX_ENTRIES) evictOldest();
  store.set(key, { count: 1, resetAt: now + windowMs });
  return true;
}

export function rateLimitHeaders(key: string): Record<string, string> {
  const current = store.get(key);
  if (!current) return {};
  return { "Retry-After": String(Math.max(1, Math.ceil((current.resetAt - Date.now()) / 1000))) };
}

/** Introspection exists to make the bounded-store guarantee testable. */
export function rateLimitEntryCount() {
  return store.size;
}
