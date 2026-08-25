CREATE TYPE "MediaCollectionType" AS ENUM ('CERTIFICATES', 'STUDIO_GALLERY', 'REFERENCES');

ALTER TABLE "SiteSettings"
ADD COLUMN "contactPhotoMediaId" TEXT,
ADD COLUMN "homePortraitMediaId" TEXT,
ADD COLUMN "aboutPortraitMediaId" TEXT;

CREATE TABLE "MediaCollection" (
    "id" TEXT NOT NULL,
    "type" "MediaCollectionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaCollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "altText" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaCollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaCollection_type_key" ON "MediaCollection"("type");
CREATE UNIQUE INDEX "MediaCollectionItem_collectionId_mediaAssetId_key" ON "MediaCollectionItem"("collectionId", "mediaAssetId");
CREATE UNIQUE INDEX "MediaCollectionItem_collectionId_sortOrder_key" ON "MediaCollectionItem"("collectionId", "sortOrder");
CREATE INDEX "MediaCollectionItem_mediaAssetId_idx" ON "MediaCollectionItem"("mediaAssetId");
CREATE INDEX "MediaCollectionItem_collectionId_isVisible_sortOrder_id_idx" ON "MediaCollectionItem"("collectionId", "isVisible", "sortOrder", "id");
CREATE INDEX "SiteSettings_contactPhotoMediaId_idx" ON "SiteSettings"("contactPhotoMediaId");
CREATE INDEX "SiteSettings_homePortraitMediaId_idx" ON "SiteSettings"("homePortraitMediaId");
CREATE INDEX "SiteSettings_aboutPortraitMediaId_idx" ON "SiteSettings"("aboutPortraitMediaId");

ALTER TABLE "MediaCollectionItem"
ADD CONSTRAINT "MediaCollectionItem_collectionId_fkey"
FOREIGN KEY ("collectionId") REFERENCES "MediaCollection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaCollectionItem"
ADD CONSTRAINT "MediaCollectionItem_mediaAssetId_fkey"
FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SiteSettings"
ADD CONSTRAINT "SiteSettings_contactPhotoMediaId_fkey"
FOREIGN KEY ("contactPhotoMediaId") REFERENCES "MediaAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SiteSettings"
ADD CONSTRAINT "SiteSettings_homePortraitMediaId_fkey"
FOREIGN KEY ("homePortraitMediaId") REFERENCES "MediaAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SiteSettings"
ADD CONSTRAINT "SiteSettings_aboutPortraitMediaId_fkey"
FOREIGN KEY ("aboutPortraitMediaId") REFERENCES "MediaAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
