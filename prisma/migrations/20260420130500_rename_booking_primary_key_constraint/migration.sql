DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'BookingRequest_pkey'
      AND conrelid = '"Booking"'::regclass
  ) THEN
    ALTER TABLE "Booking" RENAME CONSTRAINT "BookingRequest_pkey" TO "Booking_pkey";
  END IF;
END $$;
