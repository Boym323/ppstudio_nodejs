CREATE TABLE "PushoverNotificationCooldown" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushoverNotificationCooldown_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushoverNotificationCooldown_eventType_sourceHash_key"
  ON "PushoverNotificationCooldown"("eventType", "sourceHash");
CREATE INDEX "PushoverNotificationCooldown_lastSentAt_idx"
  ON "PushoverNotificationCooldown"("lastSentAt");
