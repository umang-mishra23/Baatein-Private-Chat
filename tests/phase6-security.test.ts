import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildAllowedOrigins, isAllowedMutationOrigin } from "@/server/security/origin-policy";
import { sanitizeSecurityMetadata } from "@/server/logger";
import { allowRateLimit, rateLimitEntryCount } from "@/server/rate-limit";
import { socketConversationSchema, socketMessageSchema, invitationAcceptSchema } from "@/lib/validation";

const allowed = new Set(["https://chat.example.test", "http://localhost:3000"]);

test("mutation origin policy accepts exact configured Origin", () => {
  assert.equal(isAllowedMutationOrigin({ origin: "https://chat.example.test", fetchSite: "same-origin" }, allowed), true);
});

test("mutation origin policy rejects cross-origin, cross-site, and missing-origin requests", () => {
  assert.equal(isAllowedMutationOrigin({ origin: "https://evil.example", fetchSite: "cross-site" }, allowed), false);
  assert.equal(isAllowedMutationOrigin({ origin: "https://chat.example.test", fetchSite: "cross-site" }, allowed), false);
  assert.equal(isAllowedMutationOrigin({}, allowed), false);
  assert.equal(isAllowedMutationOrigin({ origin: "null" }, allowed), false);
});

test("referer is a fallback only when Origin is absent", () => {
  assert.equal(isAllowedMutationOrigin({ referer: "https://chat.example.test/settings" }, allowed), true);
  assert.equal(isAllowedMutationOrigin({ origin: "https://evil.example", referer: "https://chat.example.test/settings" }, allowed), false);
});

test("development origins include local testing but production origins do not", () => {
  const dev = buildAllowedOrigins({ NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "https://chat.example.test", REALTIME_ORIGIN: "https://chat.example.test" } as NodeJS.ProcessEnv);
  assert.equal(dev.has("http://localhost:3000"), true);
  const prod = buildAllowedOrigins({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://chat.example.test", REALTIME_ORIGIN: "https://chat.example.test" } as NodeJS.ProcessEnv);
  assert.equal(prod.has("http://localhost:3000"), false);
});

test("security logger metadata drops message content, phone numbers, tokens and unknown fields", () => {
  const result = sanitizeSecurityMetadata({
    recipientHash: "a".repeat(64),
    reason: "SPAM",
    count: 3,
    phoneNumber: "+919999999999",
    message: "private text",
    token: "secret-token",
    authToken: "secret-auth",
  });
  assert.deepEqual(result, { recipientHash: "a".repeat(64), reason: "SPAM", count: 3 });
});

test("Socket.IO schemas reject malformed IDs and extra fields", () => {
  assert.equal(socketConversationSchema.safeParse({ conversationId: randomUUID() }).success, true);
  assert.equal(socketConversationSchema.safeParse({ conversationId: "bad" }).success, false);
  assert.equal(socketConversationSchema.safeParse({ conversationId: randomUUID(), userId: randomUUID() }).success, false);
});

test("socket message schema preserves valid idempotency key and rejects oversized content", () => {
  const clientMessageId = randomUUID();
  const valid = socketMessageSchema.safeParse({ conversationId: randomUUID(), text: " hello ", clientMessageId });
  assert.equal(valid.success, true);
  if (valid.success) assert.equal(valid.data.clientMessageId, clientMessageId);
  assert.equal(socketMessageSchema.safeParse({ conversationId: randomUUID(), text: "x".repeat(4001) }).success, false);
});

test("invitation acceptance schema rejects extra fields and malformed token", () => {
  assert.equal(invitationAcceptSchema.safeParse({ token: "A".repeat(43), username: "Ram" }).success, true);
  assert.equal(invitationAcceptSchema.safeParse({ token: "bad", username: "Ram" }).success, false);
  assert.equal(invitationAcceptSchema.safeParse({ token: "A".repeat(43), username: "Ram", isAdmin: true }).success, false);
});

test("rate limiter enforces a fixed-window limit", () => {
  const key = `phase6-test:${randomUUID()}`;
  assert.equal(allowRateLimit(key, 2, 60_000), true);
  assert.equal(allowRateLimit(key, 2, 60_000), true);
  assert.equal(allowRateLimit(key, 2, 60_000), false);
});

test("rate limiter storage remains bounded under many unique keys", () => {
  const prefix = `phase6-cap:${randomUUID()}:`;
  for (let i = 0; i < 20_050; i += 1) allowRateLimit(`${prefix}${i}`, 1, 60_000);
  assert.ok(rateLimitEntryCount() <= 20_000);
});
