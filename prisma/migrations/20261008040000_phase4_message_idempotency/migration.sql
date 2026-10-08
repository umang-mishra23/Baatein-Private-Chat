-- Phase 4: make realtime message retries idempotent.
ALTER TABLE "Message" ADD COLUMN "clientMessageId" UUID;
CREATE UNIQUE INDEX "Message_senderId_clientMessageId_key" ON "Message"("senderId", "clientMessageId");
