import crypto from "node:crypto";

function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 32) throw new Error(`${name} must be configured with at least 32 characters.`);
  return value;
}

export function randomToken(bytes = 32): string { return crypto.randomBytes(bytes).toString("base64url"); }
export function sha256(value: string): string { return crypto.createHash("sha256").update(value).digest("hex"); }
export function hmac(value: string, secretName: string): string { return crypto.createHmac("sha256", requireSecret(secretName)).update(value).digest("hex"); }
export function hashSessionToken(token: string): string { return hmac(token, "SESSION_SECRET"); }
export function hashInviteToken(token: string): string { return hmac(token, "INVITE_HMAC_SECRET"); }
export function hashPhoneLookup(normalizedE164: string): string { return hmac(normalizedE164, "LOOKUP_HMAC_SECRET"); }
export function hashIp(ip: string): string { return hmac(ip, "IP_HASH_SECRET"); }
export function hashUserAgent(userAgent: string): string { return hmac(userAgent, "IP_HASH_SECRET"); }

export function encryptSensitive(plaintext: string): string {
  const key = Buffer.from(requireSecret("PHONE_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("PHONE_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptSensitive(value: string): string {
  const key = Buffer.from(requireSecret("PHONE_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("PHONE_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  const [ivRaw, tagRaw, ciphertextRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error("Invalid encrypted value.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
}


export function encryptWithKey(plaintext: string, envName: string): string {
  const key = Buffer.from(requireSecret(envName), "base64");
  if (key.length !== 32) throw new Error(`${envName} must decode to exactly 32 bytes.`);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptWithKey(value: string, envName: string): string {
  const key = Buffer.from(requireSecret(envName), "base64");
  if (key.length !== 32) throw new Error(`${envName} must decode to exactly 32 bytes.`);
  const [ivRaw, tagRaw, ciphertextRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error("Invalid encrypted value.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptMessage(plaintext: string): string {
  return encryptWithKey(plaintext, "MESSAGE_ENCRYPTION_KEY");
}

export function decryptMessage(ciphertext: string): string {
  return decryptWithKey(ciphertext, "MESSAGE_ENCRYPTION_KEY");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
