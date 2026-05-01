import "dotenv/config";
import { Client } from "pg";

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
  };
}

function exitWithError(message, details) {
  console.error(message);

  if (details) {
    console.error(details);
  }

  process.exit(1);
}

function formatUtc(value) {
  return new Date(value).toISOString();
}

async function loadCandidates(client) {
  const result = await client.query(`
    SELECT
      b."id" AS booking_id,
      b."status" AS booking_status,
      b."scheduledStartsAt" AS booking_starts_at,
      b."scheduledEndsAt" AS booking_ends_at,
      b."serviceNameSnapshot" AS service_name,
      b."clientNameSnapshot" AS client_name,
      s."id" AS slot_id,
      s."startsAt" AS slot_starts_at,
      s."endsAt" AS slot_ends_at,
      s."capacity" AS slot_capacity,
      s."status" AS slot_status,
      s."serviceRestrictionMode" AS slot_restriction_mode,
      s."publicNote" AS slot_public_note,
      s."internalNote" AS slot_internal_note,
      s."publishedAt" AS slot_published_at,
      s."cancelledAt" AS slot_cancelled_at,
      s."createdByUserId" AS slot_created_by_user_id,
      (
        SELECT COUNT(*)::int
        FROM "Booking" bx
        WHERE bx."slotId" = s."id"
      ) AS slot_booking_count,
      EXISTS(
        SELECT 1
        FROM "AvailabilitySlotService" ass
        WHERE ass."slotId" = s."id"
      ) AS slot_has_allowed_services
    FROM "Booking" b
    JOIN "AvailabilitySlot" s ON s."id" = b."slotId"
    WHERE b."status" IN ('PENDING', 'CONFIRMED', 'COMPLETED')
      AND s."status" = 'PUBLISHED'
      AND s."capacity" = 1
      AND s."publicNote" IS NULL
      AND s."internalNote" IS NULL
      AND s."serviceRestrictionMode" = 'ANY'
      AND (
        b."scheduledStartsAt" > s."startsAt"
        OR b."scheduledEndsAt" < s."endsAt"
        OR b."scheduledEndsAt" > s."endsAt"
      )
    ORDER BY b."scheduledStartsAt" ASC
  `);

  return result.rows;
}

function classifyCandidate(row) {
  if (row.slot_has_allowed_services) {
    return {
      kind: "skipped",
      reason: "slot_has_allowed_services",
    };
  }

  if (row.slot_booking_count !== 1) {
    return {
      kind: "skipped",
      reason: "slot_has_multiple_bookings",
    };
  }

  const bookingStartsAt = new Date(row.booking_starts_at);
  const bookingEndsAt = new Date(row.booking_ends_at);
  const slotStartsAt = new Date(row.slot_starts_at);
  const slotEndsAt = new Date(row.slot_ends_at);

  if (bookingStartsAt <= slotStartsAt && bookingEndsAt >= slotEndsAt) {
    return {
      kind: "skipped",
      reason: "slot_already_fully_covered",
    };
  }

  if (bookingStartsAt < slotStartsAt) {
    return {
      kind: "skipped",
      reason: "booking_starts_before_slot",
    };
  }

  if (bookingStartsAt >= slotEndsAt) {
    return {
      kind: "skipped",
      reason: "booking_starts_outside_slot",
    };
  }

  return {
    kind: "repairable",
    createBeforeFragment: bookingStartsAt > slotStartsAt,
    createAfterFragment: bookingEndsAt < slotEndsAt,
  };
}

function summarizeCandidate(row, classification) {
  return {
    bookingId: row.booking_id,
    bookingStatus: row.booking_status,
    serviceName: row.service_name,
    clientName: row.client_name,
    bookingStartsAt: formatUtc(row.booking_starts_at),
    bookingEndsAt: formatUtc(row.booking_ends_at),
    slotId: row.slot_id,
    slotStartsAt: formatUtc(row.slot_starts_at),
    slotEndsAt: formatUtc(row.slot_ends_at),
    slotBookingCount: row.slot_booking_count,
    result: classification.kind,
    reason: classification.kind === "skipped" ? classification.reason : null,
    fragments:
      classification.kind === "repairable"
        ? {
            before: classification.createBeforeFragment,
            after: classification.createAfterFragment,
          }
        : null,
  };
}

async function repairCandidate(client, row, classification) {
  const bookingStartsAt = new Date(row.booking_starts_at);
  const bookingEndsAt = new Date(row.booking_ends_at);
  const slotStartsAt = new Date(row.slot_starts_at);
  const slotEndsAt = new Date(row.slot_ends_at);

  await client.query("BEGIN");

  try {
    await client.query(
      `
        UPDATE "AvailabilitySlot"
        SET "startsAt" = $2,
            "endsAt" = $3,
            "updatedAt" = NOW()
        WHERE "id" = $1
      `,
      [
        row.slot_id,
        bookingStartsAt.toISOString(),
        new Date(Math.min(bookingEndsAt.getTime(), slotEndsAt.getTime())).toISOString(),
      ],
    );

    if (classification.createBeforeFragment) {
      await client.query(
        `
          INSERT INTO "AvailabilitySlot" (
            "id",
            "startsAt",
            "endsAt",
            "capacity",
            "status",
            "serviceRestrictionMode",
            "publicNote",
            "internalNote",
            "publishedAt",
            "cancelledAt",
            "createdByUserId",
            "createdAt",
            "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            NOW(),
            NOW()
          )
        `,
        [
          slotStartsAt.toISOString(),
          bookingStartsAt.toISOString(),
          row.slot_capacity,
          row.slot_status,
          row.slot_restriction_mode,
          row.slot_public_note,
          row.slot_internal_note,
          row.slot_published_at,
          row.slot_cancelled_at,
          row.slot_created_by_user_id,
        ],
      );
    }

    if (classification.createAfterFragment) {
      await client.query(
        `
          INSERT INTO "AvailabilitySlot" (
            "id",
            "startsAt",
            "endsAt",
            "capacity",
            "status",
            "serviceRestrictionMode",
            "publicNote",
            "internalNote",
            "publishedAt",
            "cancelledAt",
            "createdByUserId",
            "createdAt",
            "updatedAt"
          ) VALUES (
            gen_random_uuid()::text,
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            NOW(),
            NOW()
          )
        `,
        [
          bookingEndsAt.toISOString(),
          slotEndsAt.toISOString(),
          row.slot_capacity,
          row.slot_status,
          row.slot_restriction_mode,
          row.slot_public_note,
          row.slot_internal_note,
          row.slot_published_at,
          row.slot_cancelled_at,
          row.slot_created_by_user_id,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    exitWithError("DATABASE_URL není nastavené. Repair legacy chained slots nelze spustit.");
  }

  const { apply } = parseArgs(process.argv.slice(2));
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    const candidates = await loadCandidates(client);
    const evaluations = candidates.map((row) => {
      const classification = classifyCandidate(row);
      return {
        row,
        classification,
        summary: summarizeCandidate(row, classification),
      };
    });

    const repairable = evaluations.filter((item) => item.classification.kind === "repairable");
    const skipped = evaluations.filter((item) => item.classification.kind === "skipped");

    console.log(
      JSON.stringify(
        {
          status: apply ? "apply" : "dry-run",
          totalCandidates: evaluations.length,
          repairable: repairable.length,
          skipped: skipped.length,
          repairableItems: repairable.map((item) => item.summary),
          skippedItems: skipped.map((item) => item.summary),
        },
        null,
        2,
      ),
    );

    if (!apply) {
      console.log("");
      console.log("Dry run only, nic nebylo změněno.");
      console.log("Pro skutečný repair spusť: node scripts/repair-legacy-chained-slots.mjs --apply");
      return;
    }

    for (const item of repairable) {
      await repairCandidate(client, item.row, item.classification);
    }

    console.log("");
    console.log(`Repair hotový. Opraveno ${repairable.length} legacy chained slot případů.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  exitWithError(
    "Repair legacy chained slots selhal.",
    error instanceof Error ? error.stack : String(error),
  );
});
