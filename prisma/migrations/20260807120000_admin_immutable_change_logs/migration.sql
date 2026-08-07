CREATE TYPE "AdminUserAuditOperation" AS ENUM ('CREATE', 'UPDATE_PROFILE', 'CHANGE_ROLE', 'ACTIVATE', 'DEACTIVATE', 'INVITE_RESEND');
CREATE TYPE "VoucherChangeOperation" AS ENUM ('UPDATE_OPERATIONAL_DETAILS', 'CANCEL');
CREATE TYPE "ServiceChangeOperation" AS ENUM ('UPDATE_OPERATIONAL_DETAILS', 'TOGGLE_ACTIVE', 'TOGGLE_BOOKABLE');
CREATE TYPE "SiteSettingsChangeOperation" AS ENUM ('UPDATE_SALON', 'UPDATE_BOOKING_POLICY', 'UPDATE_EMAIL');

CREATE TABLE "AdminUserAuditEvent" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "operation" "AdminUserAuditOperation" NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminUserAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoucherChangeLog" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "operation" "VoucherChangeOperation" NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VoucherChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceChangeLog" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "operation" "ServiceChangeOperation" NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteSettingsChangeLog" (
    "id" TEXT NOT NULL,
    "siteSettingsId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "operation" "SiteSettingsChangeOperation" NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteSettingsChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminUserAuditEvent_targetUserId_createdAt_idx" ON "AdminUserAuditEvent"("targetUserId", "createdAt");
CREATE INDEX "AdminUserAuditEvent_createdAt_id_idx" ON "AdminUserAuditEvent"("createdAt", "id");
CREATE INDEX "VoucherChangeLog_voucherId_createdAt_idx" ON "VoucherChangeLog"("voucherId", "createdAt");
CREATE INDEX "VoucherChangeLog_createdAt_id_idx" ON "VoucherChangeLog"("createdAt", "id");
CREATE INDEX "ServiceChangeLog_serviceId_createdAt_idx" ON "ServiceChangeLog"("serviceId", "createdAt");
CREATE INDEX "ServiceChangeLog_createdAt_id_idx" ON "ServiceChangeLog"("createdAt", "id");
CREATE INDEX "SiteSettingsChangeLog_siteSettingsId_createdAt_idx" ON "SiteSettingsChangeLog"("siteSettingsId", "createdAt");
CREATE INDEX "SiteSettingsChangeLog_createdAt_id_idx" ON "SiteSettingsChangeLog"("createdAt", "id");

ALTER TABLE "AdminUserAuditEvent" ADD CONSTRAINT "AdminUserAuditEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdminUserAuditEvent" ADD CONSTRAINT "AdminUserAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoucherChangeLog" ADD CONSTRAINT "VoucherChangeLog_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoucherChangeLog" ADD CONSTRAINT "VoucherChangeLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceChangeLog" ADD CONSTRAINT "ServiceChangeLog_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceChangeLog" ADD CONSTRAINT "ServiceChangeLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteSettingsChangeLog" ADD CONSTRAINT "SiteSettingsChangeLog_siteSettingsId_fkey" FOREIGN KEY ("siteSettingsId") REFERENCES "SiteSettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteSettingsChangeLog" ADD CONSTRAINT "SiteSettingsChangeLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
