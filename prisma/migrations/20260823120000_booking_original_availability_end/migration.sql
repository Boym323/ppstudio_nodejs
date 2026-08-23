-- Umožní při stornu obnovit jen dostupnost, která byla vypsaná před vytvořením rezervace.
ALTER TABLE "Booking" ADD COLUMN "originalAvailabilityEndsAt" TIMESTAMP(3);
