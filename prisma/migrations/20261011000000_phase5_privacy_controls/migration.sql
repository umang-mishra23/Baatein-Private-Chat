-- Phase 5: allow a conversation to be hidden for one member without
-- deleting the other participant's history.
ALTER TABLE "ConversationMember"
ADD COLUMN "hiddenAt" TIMESTAMP(3);

CREATE INDEX "ConversationMember_userId_hiddenAt_idx"
ON "ConversationMember"("userId", "hiddenAt");
