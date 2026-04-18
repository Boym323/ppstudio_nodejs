ALTER TABLE "EmailLog"
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "processingStartedAt" TIMESTAMP(3),
ADD COLUMN "processingToken" TEXT;

CREATE INDEX "EmailLog_status_nextAttemptAt_idx" ON "EmailLog"("status", "nextAttemptAt");
CREATE INDEX "EmailLog_processingStartedAt_idx" ON "EmailLog"("processingStartedAt");
