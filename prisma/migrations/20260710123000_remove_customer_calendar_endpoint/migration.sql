-- Zákaznický ICS export byl nahrazen přílohou v e-mailu. Historické tokeny
-- už nesmějí zůstávat ve schématu ani v datech.
DELETE FROM "BookingActionToken" WHERE "type" = 'CALENDAR';

ALTER TYPE "BookingActionTokenType" RENAME TO "BookingActionTokenType_old";
CREATE TYPE "BookingActionTokenType" AS ENUM ('CANCEL', 'RESCHEDULE', 'APPROVE', 'REJECT');
ALTER TABLE "BookingActionToken"
  ALTER COLUMN "type" TYPE "BookingActionTokenType"
  USING ("type"::text::"BookingActionTokenType");
DROP TYPE "BookingActionTokenType_old";
