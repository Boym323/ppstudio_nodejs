CREATE TABLE "UserNotificationSettings" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pushoverUserKey" TEXT,
  "pushoverEnabled" BOOLEAN NOT NULL DEFAULT false,
  "notifyNewBooking" BOOLEAN NOT NULL DEFAULT true,
  "notifyBookingConfirmed" BOOLEAN NOT NULL DEFAULT true,
  "notifyBookingCancelled" BOOLEAN NOT NULL DEFAULT true,
  "notifyBookingRescheduled" BOOLEAN NOT NULL DEFAULT true,
  "notifyBookingPending" BOOLEAN NOT NULL DEFAULT true,
  "notifyEmailFailed" BOOLEAN NOT NULL DEFAULT true,
  "notifyReminderFailed" BOOLEAN NOT NULL DEFAULT true,
  "notifySystemErrors" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserNotificationSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserNotificationSettings_userId_key"
ON "UserNotificationSettings"("userId");

CREATE INDEX "UserNotificationSettings_pushoverEnabled_idx"
ON "UserNotificationSettings"("pushoverEnabled");

ALTER TABLE "UserNotificationSettings"
ADD CONSTRAINT "UserNotificationSettings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "AdminUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
