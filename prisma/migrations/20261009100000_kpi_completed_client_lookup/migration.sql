-- CreateIndex
CREATE INDEX "Booking_clientId_status_scheduledStartsAt_idx" ON "Booking"("clientId", "status", "scheduledStartsAt");
