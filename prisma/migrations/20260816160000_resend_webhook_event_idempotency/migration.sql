CREATE TABLE "EmailProviderWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3) NOT NULL,
  "outcome" TEXT NOT NULL,

  CONSTRAINT "EmailProviderWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailProviderWebhookEvent_provider_providerEventId_key"
ON "EmailProviderWebhookEvent"("provider", "providerEventId");

CREATE INDEX "EmailProviderWebhookEvent_providerMessageId_idx"
ON "EmailProviderWebhookEvent"("providerMessageId");

CREATE INDEX "EmailProviderWebhookEvent_receivedAt_idx"
ON "EmailProviderWebhookEvent"("receivedAt");
