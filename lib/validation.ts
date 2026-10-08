import { z } from "zod";

export const usernameSchema = z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dot, underscore, or hyphen.");
export const phoneSchema = z.string().trim().min(7).max(30);
export const inviteRequestSchema = z.object({ recipientPhone: phoneSchema, firstMessage: z.string().trim().max(1000).optional() });
export const usernameUpdateSchema = z.object({ username: usernameSchema });
export const sessionBootstrapSchema = z.object({});
export const messageSchema = z.object({ text: z.string().trim().min(1).max(4000), clientMessageId: z.string().uuid().optional() });
export const readReceiptSchema = z.object({ messageId: z.string().uuid() });
