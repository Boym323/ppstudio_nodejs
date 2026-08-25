-- Service Media: reusable assets with role-specific ordering.
CREATE TYPE "ServiceMediaRole" AS ENUM ('HERO', 'GALLERY');

CREATE TABLE "ServiceMedia" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "role" "ServiceMediaRole" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "altText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceMedia_serviceId_role_mediaAssetId_key" ON "ServiceMedia"("serviceId", "role", "mediaAssetId");
CREATE UNIQUE INDEX "ServiceMedia_serviceId_role_sortOrder_key" ON "ServiceMedia"("serviceId", "role", "sortOrder");
CREATE INDEX "ServiceMedia_mediaAssetId_idx" ON "ServiceMedia"("mediaAssetId");
CREATE INDEX "ServiceMedia_serviceId_role_sortOrder_id_idx" ON "ServiceMedia"("serviceId", "role", "sortOrder", "id");

-- Prisma schema cannot express a partial unique index. This protects HERO even
-- if a caller bypasses the application layer.
CREATE UNIQUE INDEX "ServiceMedia_one_hero_per_service" ON "ServiceMedia"("serviceId") WHERE "role" = 'HERO';

ALTER TABLE "ServiceMedia" ADD CONSTRAINT "ServiceMedia_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceMedia" ADD CONSTRAINT "ServiceMedia_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
