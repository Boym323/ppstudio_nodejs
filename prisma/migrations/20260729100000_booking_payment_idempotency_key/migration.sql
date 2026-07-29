ALTER TABLE "BookingPayment" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "BookingPayment_idempotencyKey_key" ON "BookingPayment"("idempotencyKey");
