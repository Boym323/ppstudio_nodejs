-- Media Library v1 generalizes certificate assets without removing legacy storage columns.
CREATE TYPE "MediaType" AS ENUM ('CERTIFICATE', 'SALON_PHOTO', 'PORTRAIT', 'GENERAL');

ALTER TABLE "MediaAsset"
  ADD COLUMN "type" "MediaType" NOT NULL DEFAULT 'CERTIFICATE',
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "size" INTEGER,
  ADD COLUMN "altText" TEXT,
  ADD COLUMN "url" TEXT,
  ADD COLUMN "sortOrder" INTEGER,
  ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT true;

UPDATE "MediaAsset"
SET
  "type" = CASE "kind"
    WHEN 'CERTIFICATE' THEN 'CERTIFICATE'::"MediaType"
    WHEN 'SPACE' THEN 'SALON_PHOTO'::"MediaType"
    ELSE 'GENERAL'::"MediaType"
  END,
  "fileName" = "originalFilename",
  "size" = "sizeBytes",
  "altText" = "alt",
  "url" = '/media/' || "storagePath",
  "isPublished" = CASE "visibility"
    WHEN 'PUBLIC' THEN true
    ELSE false
  END;

ALTER TABLE "MediaAsset"
  ALTER COLUMN "fileName" SET NOT NULL,
  ALTER COLUMN "size" SET NOT NULL,
  ALTER COLUMN "url" SET NOT NULL;

CREATE INDEX "MediaAsset_type_isPublished_sortOrder_idx" ON "MediaAsset"("type", "isPublished", "sortOrder");
CREATE INDEX "MediaAsset_type_createdAt_idx" ON "MediaAsset"("type", "createdAt");
