CREATE TYPE "EmailIncidentResolutionKind" AS ENUM ('DELIVERED_RESEND', 'MANUAL');
CREATE TYPE "EmailIncidentManualResolutionReason" AS ENUM ('HISTORICAL', 'CONTACTED_OTHER_WAY', 'NO_LONGER_RELEVANT', 'OTHER');

ALTER TABLE "EmailLog"
  ADD COLUMN "incidentResolutionKind" "EmailIncidentResolutionKind",
  ADD COLUMN "incidentManualResolvedByUserId" TEXT,
  ADD COLUMN "incidentManualResolutionReason" "EmailIncidentManualResolutionReason",
  ADD COLUMN "incidentManualResolutionNote" TEXT;

CREATE INDEX "EmailLog_incidentManualResolvedByUserId_idx" ON "EmailLog"("incidentManualResolvedByUserId");

ALTER TABLE "EmailLog"
  ADD CONSTRAINT "EmailLog_incidentManualResolvedByUserId_fkey"
  FOREIGN KEY ("incidentManualResolvedByUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
