-- CreateEnum
CREATE TYPE "VoucherPrintBatchStatus" AS ENUM ('PENDING_PRINT', 'RECEIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "VoucherStockItemStatus" AS ENUM ('PENDING_PRINT', 'AVAILABLE', 'ACTIVATED', 'VOID');

-- CreateEnum
CREATE TYPE "VoucherStockAuditOperation" AS ENUM ('CREATE_VOUCHER_PRINT_BATCH', 'RECEIVE_VOUCHER_PRINT_BATCH', 'ACTIVATE_VOUCHER_STOCK_ITEM', 'VOID_VOUCHER_STOCK_ITEM', 'CLOSE_VOUCHER_PRINT_BATCH');

-- CreateTable
CREATE TABLE "VoucherPrintBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
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
CREATE INDEX "VoucherPrintBatch_createdByUserId_idx" ON "VoucherPrintBatch"("createdByUserId");

-- CreateIndex
CREATE INDEX "VoucherPrintBatch_receivedByUserId_idx" ON "VoucherPrintBatch"("receivedByUserId");

-- CreateIndex
CREATE INDEX "VoucherPrintBatch_closedByUserId_idx" ON "VoucherPrintBatch"("closedByUserId");

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

-- AddForeignKey
ALTER TABLE "VoucherPrintBatch" ADD CONSTRAINT "VoucherPrintBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherPrintBatch" ADD CONSTRAINT "VoucherPrintBatch_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherPrintBatch" ADD CONSTRAINT "VoucherPrintBatch_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
