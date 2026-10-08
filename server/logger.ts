import { randomUUID } from "node:crypto";

export type SecurityLog = { type: string; outcome: "success" | "failure"; userId?: string; ipHash?: string; metadata?: Record<string, string | number | boolean> };
export function securityLog(event: SecurityLog) { const payload = { requestId: randomUUID(), timestamp: new Date().toISOString(), ...event }; console.info(JSON.stringify(payload)); }
