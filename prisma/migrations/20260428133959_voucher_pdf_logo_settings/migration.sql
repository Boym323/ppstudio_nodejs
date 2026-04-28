ALTER TABLE "SiteSettings"
ADD COLUMN "voucherPdfLogoMediaId" TEXT;

CREATE INDEX "SiteSettings_voucherPdfLogoMediaId_idx" ON "SiteSettings"("voucherPdfLogoMediaId");

ALTER TABLE "SiteSettings"
ADD CONSTRAINT "SiteSettings_voucherPdfLogoMediaId_fkey"
FOREIGN KEY ("voucherPdfLogoMediaId") REFERENCES "MediaAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
