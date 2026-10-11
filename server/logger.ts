import { randomUUID } from "node:crypto";

export type SecurityLog = {
  type: string;
  outcome: "success" | "failure";
  userId?: string;
  ipHash?: string;
  metadata?: Record<string, string | number | boolean>;
};

const SAFE_REASONS = new Set(["SPAM", "HARASSMENT", "THREATS", "IMPERSONATION", "OTHER"]);
const SAFE_METADATA_KEYS = new Set(["recipientHash", "reason", "count"]);

/** Keep only explicitly approved, non-content metadata in security logs. */
export function sanitizeSecurityMetadata(metadata?: SecurityLog["metadata"]) {
  const safe: Record<string, string | number | boolean> = {};
  if (!metadata) return safe;

  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue;
    if (key === "recipientHash" && typeof value === "string" && /^[a-f0-9]{64}$/i.test(value)) safe[key] = value;
    if (key === "reason" && typeof value === "string" && SAFE_REASONS.has(value)) safe[key] = value;
    if (key === "count" && typeof value === "number" && Number.isSafeInteger(value) && value >= 0) safe[key] = value;
  }

  return safe;
}

export function securityLog(event: SecurityLog) {
  const payload = {
    requestId: randomUUID(),
    timestamp: new Date().toISOString(),
    type: /^[a-z0-9_.-]{1,64}$/i.test(event.type) ? event.type : "security_event",
    outcome: event.outcome,
    ...(event.userId && /^[0-9a-f-]{36}$/i.test(event.userId) ? { userId: event.userId } : {}),
    ...(event.ipHash && /^[a-f0-9]{64}$/i.test(event.ipHash) ? { ipHash: event.ipHash } : {}),
    metadata: sanitizeSecurityMetadata(event.metadata),
  };
  console.info(JSON.stringify(payload));
}
