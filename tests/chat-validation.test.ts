import test from "node:test";
import assert from "node:assert/strict";
import { messageSchema } from "@/lib/validation";

test("chat messages require non-empty text and accept UUID idempotency keys", () => {
  const valid = messageSchema.safeParse({ text: "hello", clientMessageId: "550e8400-e29b-41d4-a716-446655440000" });
  assert.equal(valid.success, true);
});

test("chat message validation rejects oversized and empty payloads", () => {
  assert.equal(messageSchema.safeParse({ text: "" }).success, false);
  assert.equal(messageSchema.safeParse({ text: "x".repeat(4001) }).success, false);
});

test("chat message validation rejects malformed idempotency keys", () => {
  assert.equal(messageSchema.safeParse({ text: "hello", clientMessageId: "not-a-uuid" }).success, false);
});
