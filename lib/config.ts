import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  SHADOW_DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  PHONE_ENCRYPTION_KEY: z.string().min(40),
  MESSAGE_ENCRYPTION_KEY: z.string().min(40),
  LOOKUP_HMAC_SECRET: z.string().min(32),
  INVITE_HMAC_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  IP_HASH_SECRET: z.string().min(32),
});

export const env = schema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  SHADOW_DATABASE_URL: process.env.SHADOW_DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  PHONE_ENCRYPTION_KEY: process.env.PHONE_ENCRYPTION_KEY,
  MESSAGE_ENCRYPTION_KEY: process.env.MESSAGE_ENCRYPTION_KEY,
  LOOKUP_HMAC_SECRET: process.env.LOOKUP_HMAC_SECRET,
  INVITE_HMAC_SECRET: process.env.INVITE_HMAC_SECRET,
  CSRF_SECRET: process.env.CSRF_SECRET,
  IP_HASH_SECRET: process.env.IP_HASH_SECRET,
});
