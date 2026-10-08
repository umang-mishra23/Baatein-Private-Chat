import test from "node:test";
import assert from "node:assert/strict";
import {
  constantTimeEqual,
  decryptMessage,
  decryptSensitive,
  encryptMessage,
  encryptSensitive,
  hashInviteToken,
  randomToken,
} from "@/lib/security";

const secret = Buffer.alloc(32, 7).toString("base64");
process.env.SESSION_SECRET = secret;
process.env.INVITE_HMAC_SECRET = secret;
process.env.LOOKUP_HMAC_SECRET = secret;
process.env.IP_HASH_SECRET = secret;
process.env.CSRF_SECRET = secret;
process.env.PHONE_ENCRYPTION_KEY = secret;
process.env.MESSAGE_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");

test("random invitation tokens are high entropy and unique", () => {
  const a = randomToken(32);
  const b = randomToken(32);
  assert.notEqual(a, b);
  assert.equal(a.length, 43);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
});

test("invitation hashes are deterministic without storing raw tokens", () => {
  const token = randomToken(32);
  assert.equal(hashInviteToken(token), hashInviteToken(token));
  assert.notEqual(hashInviteToken(token), token);
});

test("sensitive phone values round-trip through authenticated encryption", () => {
  const value = "+919876543210";
  const encrypted = encryptSensitive(value);
  assert.notEqual(encrypted, value);
  assert.equal(decryptSensitive(encrypted), value);
});

test("message values round-trip through a separate encryption key", () => {
  const value = "Private first message";
  const encrypted = encryptMessage(value);
  assert.notEqual(encrypted, value);
  assert.equal(decryptMessage(encrypted), value);
});

test("constant time equality rejects different lengths and values", () => {
  assert.equal(constantTimeEqual("a", "a"), true);
  assert.equal(constantTimeEqual("a", "b"), false);
  assert.equal(constantTimeEqual("a", "aa"), false);
});
