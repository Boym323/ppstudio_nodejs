-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledByUserId" TEXT,
ADD COLUMN     "updatedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Voucher_cancelledByUserId_idx" ON "Voucher"("cancelledByUserId");

-- CreateIndex
CREATE INDEX "Voucher_updatedByUserId_idx" ON "Voucher"("updatedByUserId");

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
