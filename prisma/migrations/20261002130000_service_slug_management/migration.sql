-- CreateTable
CREATE TABLE "ServiceSlugAlias" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceSlugAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceSlugAlias_slug_key" ON "ServiceSlugAlias"("slug");

-- CreateIndex
CREATE INDEX "ServiceSlugAlias_serviceId_idx" ON "ServiceSlugAlias"("serviceId");

-- AddForeignKey
ALTER TABLE "ServiceSlugAlias" ADD CONSTRAINT "ServiceSlugAlias_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "ServiceChangeOperation" ADD VALUE 'CHANGE_PUBLIC_SLUG';
