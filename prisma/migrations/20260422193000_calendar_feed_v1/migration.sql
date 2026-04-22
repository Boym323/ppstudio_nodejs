CREATE TYPE "CalendarFeedScope" AS ENUM ('OWNER_BOOKINGS');

CREATE TABLE "CalendarFeed" (
    "id" TEXT NOT NULL,
    "scope" "CalendarFeedScope" NOT NULL,
    "tokenSalt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarFeed_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarFeed_scope_key" ON "CalendarFeed"("scope");
CREATE INDEX "CalendarFeed_updatedByUserId_idx" ON "CalendarFeed"("updatedByUserId");

ALTER TABLE "CalendarFeed"
ADD CONSTRAINT "CalendarFeed_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId") REFERENCES "AdminUser"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
