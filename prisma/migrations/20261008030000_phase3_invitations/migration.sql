-- Phase 3: invitation delivery and acceptance lifecycle.

CREATE TYPE "SmsDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TABLE "Invitation"
  ALTER COLUMN "recipientPhoneEncrypted" DROP NOT NULL,
  ADD COLUMN "initialMessageCiphertext" TEXT,
  ADD COLUMN "smsDeliveryStatus" "SmsDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "smsProviderMessageId" VARCHAR(128),
  ADD COLUMN "lastSentAt" TIMESTAMP(3),
  ADD COLUMN "resendCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Invitation_senderId_status_expiresAt_idx" ON "Invitation"("senderId", "status", "expiresAt");
