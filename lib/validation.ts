import { z } from "zod";

export const uuidSchema = z.string().uuid();
export function isUuid(value: unknown): value is string { return typeof value === "string" && uuidSchema.safeParse(value).success; }
export const usernameSchema = z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dot, underscore, or hyphen.");
export const phoneSchema = z.string().trim().min(7).max(30);
export const inviteRequestSchema = z.object({ recipientPhone: phoneSchema, firstMessage: z.string().trim().max(1000).optional() }).strict();
export const invitationAcceptSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  username: usernameSchema,
}).strict();
export const usernameUpdateSchema = z.object({ username: usernameSchema }).strict();
export const sessionBootstrapSchema = z.object({}).strict();
export const messageSchema = z.object({ text: z.string().trim().min(1).max(4000), clientMessageId: z.string().uuid().optional() }).strict();
export const readReceiptSchema = z.object({ messageId: z.string().uuid() }).strict();
export const socketConversationSchema = z.object({ conversationId: uuidSchema }).strict();
export const socketReadSchema = z.object({ conversationId: uuidSchema, messageId: uuidSchema }).strict();
export const socketMessageSchema = z.object({ conversationId: uuidSchema, text: z.string().trim().min(1).max(4000), clientMessageId: z.string().uuid().optional() }).strict();
export const socketDeleteMessageSchema = z.object({ conversationId: uuidSchema, messageId: uuidSchema }).strict();

export const reportSchema = z.object({
  reason: z.enum(["SPAM", "HARASSMENT", "THREATS", "IMPERSONATION", "OTHER"]),
  details: z.string().trim().max(2000).optional(),
}).strict();
