-- CreateEnum
CREATE TYPE "MediaStorageProvider" AS ENUM ('LOCAL');

-- CreateEnum
CREATE TYPE "MediaAssetVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "MediaAssetKind" AS ENUM ('CERTIFICATE', 'SPACE', 'REFERENCE', 'CONTENT');

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "storageProvider" "MediaStorageProvider" NOT NULL DEFAULT 'LOCAL',
    "visibility" "MediaAssetVisibility" NOT NULL DEFAULT 'PUBLIC',
    "kind" "MediaAssetKind" NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storedFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt" TEXT,
    "title" TEXT,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storagePath_key" ON "MediaAsset"("storagePath");

-- CreateIndex
CREATE INDEX "MediaAsset_kind_createdAt_idx" ON "MediaAsset"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_visibility_kind_createdAt_idx" ON "MediaAsset"("visibility", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_storageProvider_kind_createdAt_idx" ON "MediaAsset"("storageProvider", "kind", "createdAt");
