CREATE TYPE "AvailabilityAuditOperation" AS ENUM ('ADD', 'REMOVE', 'CLEAR', 'COPY_WEEK', 'APPLY_TEMPLATE', 'SYNC_DRAFT', 'UNDO');

CREATE TABLE "AvailabilityAuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorRole" "AdminRole",
  "adminArea" TEXT,
  "dateKey" TEXT NOT NULL,
  "timeZone" TEXT NOT NULL DEFAULT 'Europe/Prague',
  "operation" "AvailabilityAuditOperation" NOT NULL,
  "source" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "revertedOperationId" TEXT,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "createdSlots" JSONB NOT NULL,
  "archivedOrRemovedSlots" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AvailabilityAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AvailabilityAuditEvent_createdAt_idx" ON "AvailabilityAuditEvent"("createdAt");
CREATE INDEX "AvailabilityAuditEvent_dateKey_createdAt_idx" ON "AvailabilityAuditEvent"("dateKey", "createdAt");
CREATE INDEX "AvailabilityAuditEvent_operationId_idx" ON "AvailabilityAuditEvent"("operationId");
CREATE INDEX "AvailabilityAuditEvent_revertedOperationId_idx" ON "AvailabilityAuditEvent"("revertedOperationId");
CREATE INDEX "AvailabilityAuditEvent_actorUserId_createdAt_idx" ON "AvailabilityAuditEvent"("actorUserId", "createdAt");

ALTER TABLE "AvailabilityAuditEvent" ADD CONSTRAINT "AvailabilityAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
