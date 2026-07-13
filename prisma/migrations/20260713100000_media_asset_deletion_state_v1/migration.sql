ALTER TABLE "MediaAsset"
ADD COLUMN "deletionRequestedAt" TIMESTAMP(3);

CREATE INDEX "MediaAsset_deletionRequestedAt_idx"
ON "MediaAsset"("deletionRequestedAt");
