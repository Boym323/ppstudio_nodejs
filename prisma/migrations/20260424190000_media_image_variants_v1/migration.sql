ALTER TABLE "MediaAsset"
  ADD COLUMN "optimizedStoragePath" TEXT,
  ADD COLUMN "optimizedUrl" TEXT,
  ADD COLUMN "optimizedMimeType" TEXT,
  ADD COLUMN "optimizedWidth" INTEGER,
  ADD COLUMN "optimizedHeight" INTEGER,
  ADD COLUMN "optimizedSize" INTEGER,
  ADD COLUMN "thumbnailStoragePath" TEXT,
  ADD COLUMN "thumbnailUrl" TEXT,
  ADD COLUMN "thumbnailMimeType" TEXT,
  ADD COLUMN "thumbnailWidth" INTEGER,
  ADD COLUMN "thumbnailHeight" INTEGER,
  ADD COLUMN "thumbnailSize" INTEGER;

CREATE UNIQUE INDEX "MediaAsset_optimizedStoragePath_key" ON "MediaAsset"("optimizedStoragePath");
CREATE UNIQUE INDEX "MediaAsset_thumbnailStoragePath_key" ON "MediaAsset"("thumbnailStoragePath");
