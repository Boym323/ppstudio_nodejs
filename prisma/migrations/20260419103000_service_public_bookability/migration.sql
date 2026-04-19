ALTER TABLE "Service"
ADD COLUMN "isPubliclyBookable" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Service"
SET "isPubliclyBookable" = "isActive";

DROP INDEX IF EXISTS "Service_categoryId_isActive_sortOrder_idx";
DROP INDEX IF EXISTS "Service_isActive_sortOrder_idx";

CREATE INDEX "Service_categoryId_isActive_isPubliclyBookable_sortOrder_idx"
ON "Service"("categoryId", "isActive", "isPubliclyBookable", "sortOrder");

CREATE INDEX "Service_isActive_isPubliclyBookable_sortOrder_idx"
ON "Service"("isActive", "isPubliclyBookable", "sortOrder");
