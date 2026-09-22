-- CreateEnum
CREATE TYPE "VoucherTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "VoucherTemplateAuditOperation" AS ENUM ('CREATE_DRAFT', 'UPDATE_DRAFT', 'UPLOAD_MASTER', 'VALIDATE', 'PUBLISH', 'DEACTIVATE', 'CLONE_VERSION', 'DELETE_DRAFT');

-- CreateEnum
CREATE TYPE "VoucherPrintBatchStatus" AS ENUM ('PENDING_PRINT', 'RECEIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VoucherStockItemStatus" AS ENUM ('PENDING_PRINT', 'AVAILABLE', 'ACTIVATED', 'VOID');

-- CreateEnum
CREATE TYPE "VoucherStockAuditOperation" AS ENUM ('CREATE_VOUCHER_PRINT_BATCH', 'RECEIVE_VOUCHER_PRINT_BATCH', 'ACTIVATE_VOUCHER_STOCK_ITEM', 'VOID_VOUCHER_STOCK_ITEM', 'CLOSE_VOUCHER_PRINT_BATCH');

-- AlterEnum
ALTER TYPE "SiteSettingsChangeOperation" ADD VALUE 'UPDATE_VOUCHER_POLICY';

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "voucherDefaultTemplateId" TEXT,
ADD COLUMN     "voucherDefaultValidityMonths" INTEGER NOT NULL DEFAULT 12;

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "templateKey" TEXT NOT NULL DEFAULT 'classic-v1';

-- CreateTable
CREATE TABLE "VoucherPrintBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateId" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" "VoucherPrintBatchStatus" NOT NULL DEFAULT 'PENDING_PRINT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "receivedByUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,

    CONSTRAINT "VoucherPrintBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "familyKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "VoucherTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "allowedTypes" "VoucherType"[],
    "layout" JSONB NOT NULL,
    "storageProvider" "MediaStorageProvider" NOT NULL DEFAULT 'LOCAL',
    "masterStoragePath" TEXT,
    "previewStoragePath" TEXT,
    "masterSha256" TEXT,
    "createdByUserId" TEXT,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "inactivatedByUserId" TEXT,
    "inactivatedAt" TIMESTAMP(3),
    "clonedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoucherTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherTemplateAuditLog" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "templateKey" TEXT NOT NULL,
    "familyKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "actorUserId" TEXT,
    "operation" "VoucherTemplateAuditOperation" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherTemplateAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherStockItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "VoucherStockItemStatus" NOT NULL DEFAULT 'PENDING_PRINT',
    "voucherId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "activatedByUserId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherStockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherStockAuditLog" (
    "id" TEXT NOT NULL,
    "batchId" TEXT,
    "stockItemId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "operation" "VoucherStockAuditOperation" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherStockAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoucherPrintBatch_batchNumber_key" ON "VoucherPrintBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "VoucherPrintBatch_status_createdAt_idx" ON "VoucherPrintBatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VoucherPrintBatch_templateKey_idx" ON "VoucherPrintBatch"("templateKey");

-- CreateIndex
CREATE INDEX "VoucherPrintBatch_templateId_idx" ON "VoucherPrintBatch"("templateId");

-- CreateIndex
CREATE INDEX "VoucherPrintBatch_createdByUserId_idx" ON "VoucherPrintBatch"("createdByUserId");

-- CreateIndex
CREATE INDEX "VoucherPrintBatch_receivedByUserId_idx" ON "VoucherPrintBatch"("receivedByUserId");

-- CreateIndex
CREATE INDEX "VoucherPrintBatch_closedByUserId_idx" ON "VoucherPrintBatch"("closedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherTemplate_key_key" ON "VoucherTemplate"("key");

-- CreateIndex
CREATE INDEX "VoucherTemplate_status_createdAt_idx" ON "VoucherTemplate"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VoucherTemplate_familyKey_idx" ON "VoucherTemplate"("familyKey");

-- CreateIndex
CREATE INDEX "VoucherTemplate_createdByUserId_idx" ON "VoucherTemplate"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherTemplate_familyKey_version_key" ON "VoucherTemplate"("familyKey", "version");

-- CreateIndex
CREATE INDEX "VoucherTemplateAuditLog_templateId_createdAt_idx" ON "VoucherTemplateAuditLog"("templateId", "createdAt");

-- CreateIndex
CREATE INDEX "VoucherTemplateAuditLog_actorUserId_createdAt_idx" ON "VoucherTemplateAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherStockItem_code_key" ON "VoucherStockItem"("code");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherStockItem_voucherId_key" ON "VoucherStockItem"("voucherId");

-- CreateIndex
CREATE INDEX "VoucherStockItem_batchId_idx" ON "VoucherStockItem"("batchId");

-- CreateIndex
CREATE INDEX "VoucherStockItem_status_idx" ON "VoucherStockItem"("status");

-- CreateIndex
CREATE INDEX "VoucherStockItem_code_idx" ON "VoucherStockItem"("code");

-- CreateIndex
CREATE INDEX "VoucherStockItem_voucherId_idx" ON "VoucherStockItem"("voucherId");

-- CreateIndex
CREATE INDEX "VoucherStockItem_activatedByUserId_idx" ON "VoucherStockItem"("activatedByUserId");

-- CreateIndex
CREATE INDEX "VoucherStockItem_voidedByUserId_idx" ON "VoucherStockItem"("voidedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherStockItem_batchId_sequenceNumber_key" ON "VoucherStockItem"("batchId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "VoucherStockAuditLog_batchId_createdAt_idx" ON "VoucherStockAuditLog"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "VoucherStockAuditLog_stockItemId_createdAt_idx" ON "VoucherStockAuditLog"("stockItemId", "createdAt");

-- CreateIndex
CREATE INDEX "VoucherStockAuditLog_actorUserId_createdAt_idx" ON "VoucherStockAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "VoucherStockAuditLog_createdAt_id_idx" ON "VoucherStockAuditLog"("createdAt", "id");

-- CreateIndex
CREATE INDEX "SiteSettings_voucherDefaultTemplateId_idx" ON "SiteSettings"("voucherDefaultTemplateId");

-- CreateIndex
CREATE INDEX "Voucher_templateId_idx" ON "Voucher"("templateId");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VoucherTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherPrintBatch" ADD CONSTRAINT "VoucherPrintBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherPrintBatch" ADD CONSTRAINT "VoucherPrintBatch_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherPrintBatch" ADD CONSTRAINT "VoucherPrintBatch_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherPrintBatch" ADD CONSTRAINT "VoucherPrintBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VoucherTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTemplate" ADD CONSTRAINT "VoucherTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTemplate" ADD CONSTRAINT "VoucherTemplate_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTemplate" ADD CONSTRAINT "VoucherTemplate_inactivatedByUserId_fkey" FOREIGN KEY ("inactivatedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTemplate" ADD CONSTRAINT "VoucherTemplate_clonedFromId_fkey" FOREIGN KEY ("clonedFromId") REFERENCES "VoucherTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTemplateAuditLog" ADD CONSTRAINT "VoucherTemplateAuditLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "VoucherTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherTemplateAuditLog" ADD CONSTRAINT "VoucherTemplateAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherStockItem" ADD CONSTRAINT "VoucherStockItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "VoucherPrintBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherStockItem" ADD CONSTRAINT "VoucherStockItem_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherStockItem" ADD CONSTRAINT "VoucherStockItem_activatedByUserId_fkey" FOREIGN KEY ("activatedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherStockItem" ADD CONSTRAINT "VoucherStockItem_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherStockAuditLog" ADD CONSTRAINT "VoucherStockAuditLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "VoucherPrintBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherStockAuditLog" ADD CONSTRAINT "VoucherStockAuditLog_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "VoucherStockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherStockAuditLog" ADD CONSTRAINT "VoucherStockAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_voucherDefaultTemplateId_fkey" FOREIGN KEY ("voucherDefaultTemplateId") REFERENCES "VoucherTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
