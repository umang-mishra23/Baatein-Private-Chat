type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export function allowRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = store.get(key);
  if (!current || current.resetAt <= now) { store.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function rateLimitHeaders(key: string): Record<string, string> { const current = store.get(key); if (!current) return {}; return { "Retry-After": String(Math.max(1, Math.ceil((current.resetAt - Date.now()) / 1000))) }; }

// Replace this process-local limiter with Redis or another shared store before horizontal scaling.
