CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'site-settings',
    "salonName" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "instagramUrl" TEXT,
    "bookingMinAdvanceHours" INTEGER NOT NULL DEFAULT 2,
    "bookingMaxAdvanceDays" INTEGER NOT NULL DEFAULT 90,
    "bookingCancellationHours" INTEGER NOT NULL DEFAULT 48,
    "notificationAdminEmail" TEXT NOT NULL,
    "emailSenderName" TEXT NOT NULL,
    "emailSenderEmail" TEXT NOT NULL,
    "emailFooterText" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteSettings_updatedByUserId_idx" ON "SiteSettings"("updatedByUserId");

ALTER TABLE "SiteSettings"
ADD CONSTRAINT "SiteSettings_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
