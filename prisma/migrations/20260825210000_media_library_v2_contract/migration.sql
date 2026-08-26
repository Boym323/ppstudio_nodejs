-- DropIndex
DROP INDEX "MediaAsset_kind_createdAt_idx";

-- DropIndex
DROP INDEX "MediaAsset_storageProvider_kind_createdAt_idx";

-- DropIndex
DROP INDEX "MediaAsset_type_createdAt_idx";

-- DropIndex
DROP INDEX "MediaAsset_type_isPublished_sortOrder_idx";

-- DropIndex
DROP INDEX "MediaAsset_visibility_kind_createdAt_idx";

-- AlterTable
ALTER TABLE "MediaAsset" DROP COLUMN "alt",
DROP COLUMN "kind",
DROP COLUMN "sizeBytes",
DROP COLUMN "sortOrder",
DROP COLUMN "storedFilename",
DROP COLUMN "type";

-- DropEnum
DROP TYPE "MediaAssetKind";

-- DropEnum
DROP TYPE "MediaType";

-- CreateIndex
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_visibility_createdAt_idx" ON "MediaAsset"("visibility", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_storageProvider_createdAt_idx" ON "MediaAsset"("storageProvider", "createdAt");
