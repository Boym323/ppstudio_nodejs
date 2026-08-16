-- PostgreSQL zpřístupní novou enum hodnotu až po commitu předchozí migrace.
-- Šablona je pro tyto historické záznamy deterministickým zdrojem pravdy.
UPDATE "EmailLog"
SET "type" = 'BOOKING_RECEIVED'::"EmailLogType"
WHERE "type" = 'BOOKING_CONFIRMED'::"EmailLogType"
  AND "templateKey" = 'booking-confirmation-v1';
