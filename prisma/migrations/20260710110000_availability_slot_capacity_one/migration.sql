-- PP Studio obsluhuje jeden zdroj. Neopravujeme historická data potichu,
-- protože vyšší kapacita může skrývat souběžně založené rezervace vyžadující kontrolu.
DO $$
DECLARE
    invalid_slot_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO invalid_slot_count
    FROM "AvailabilitySlot"
    WHERE "capacity" <> 1;

    IF invalid_slot_count > 0 THEN
        RAISE EXCEPTION
            'Cannot enforce AvailabilitySlot capacity = 1: % slot(s) have a different capacity. Review and repair the data before retrying the migration.',
            invalid_slot_count;
    END IF;
END $$;

ALTER TABLE "AvailabilitySlot"
DROP CONSTRAINT "AvailabilitySlot_capacity_positive";

ALTER TABLE "AvailabilitySlot"
ADD CONSTRAINT "AvailabilitySlot_capacity_one" CHECK ("capacity" = 1);
