ALTER TABLE "EmailLog"
  ADD COLUMN "trackingLastEvent" TEXT,
  ADD COLUMN "trackingLastEventAt" TIMESTAMP(3),
  ADD COLUMN "trackingDeliveredAt" TIMESTAMP(3),
  ADD COLUMN "trackingOpenedAt" TIMESTAMP(3),
  ADD COLUMN "trackingClickedAt" TIMESTAMP(3),
  ADD COLUMN "trackingBouncedAt" TIMESTAMP(3),
  ADD COLUMN "trackingComplainedAt" TIMESTAMP(3),
  ADD COLUMN "trackingFailedAt" TIMESTAMP(3),
  ADD COLUMN "trackingSuppressedAt" TIMESTAMP(3),
  ADD COLUMN "trackingRawPayload" JSONB;
