CREATE TABLE "RateLimitReservation" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RateLimitReservation_scope_fingerprint_expiresAt_idx"
  ON "RateLimitReservation"("scope", "fingerprint", "expiresAt");
CREATE INDEX "RateLimitReservation_expiresAt_idx"
  ON "RateLimitReservation"("expiresAt");
