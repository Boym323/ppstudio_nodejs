-- AlterEnum
ALTER TYPE "SiteSettingsChangeOperation" ADD VALUE 'UPDATE_VOUCHER_POLICY';

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "voucherDefaultTemplateKey" TEXT NOT NULL DEFAULT 'classic-v1',
ADD COLUMN     "voucherDefaultValidityMonths" INTEGER NOT NULL DEFAULT 12;

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "templateKey" TEXT NOT NULL DEFAULT 'classic-v1';
