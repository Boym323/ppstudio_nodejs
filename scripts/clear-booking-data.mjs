import { withUtcPostgresTimezone } from "../src/lib/postgres-utc.ts";
import "dotenv/config";
import { Client } from "pg";

function parseArgs(argv) {
  const valueAfter = (name) => {
    const index = argv.indexOf(name);
    return index === -1 ? undefined : argv[index + 1];
  };
  let expectedCounts;
  try {
    expectedCounts = JSON.parse(valueAfter("--expect-counts") ?? "null");
  } catch {
    expectedCounts = undefined;
  }
  return {
    dryRun: argv.includes("--dry-run"),
    confirm: argv.includes("--confirm"),
    testDatabase: valueAfter("--test-database"),
    expectedCounts,
  };
}

function exitWithError(message, details) {
  console.error(message);

  if (details) {
    console.error(details);
  }

  process.exit(1);
}

function formatCount(label, value) {
  return `- ${label}: ${value}`;
}

async function loadCounts(client) {
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM "Booking") AS bookings,
      (SELECT COUNT(*)::int FROM "AvailabilitySlot") AS availability_slots,
      (SELECT COUNT(*)::int FROM "AvailabilitySlotService") AS availability_slot_services,
      (SELECT COUNT(*)::int FROM "BookingActionToken") AS booking_action_tokens,
      (SELECT COUNT(*)::int FROM "BookingStatusHistory") AS booking_status_history,
      (SELECT COUNT(*)::int FROM "BookingRescheduleLog") AS booking_reschedule_logs,
      (SELECT COUNT(*)::int FROM "EmailLog"
        WHERE "bookingId" IS NOT NULL
           OR "clientId" IS NOT NULL
           OR "actionTokenId" IS NOT NULL) AS related_email_logs,
      (SELECT COUNT(*)::int FROM "BookingSubmissionLog"
        WHERE "bookingId" IS NOT NULL
           OR "clientId" IS NOT NULL
           OR "slotId" IS NOT NULL) AS related_submission_logs,
      (SELECT COUNT(*)::int FROM "Client"
        WHERE NOT EXISTS (
          SELECT 1
          FROM "Booking" b
          WHERE b."clientId" = "Client"."id"
        )) AS orphan_clients
  `);

  return counts.rows[0];
}

async function deleteBookingData(client) {
  await client.query("BEGIN");

  try {
    const deleted = {};

    deleted.bookingRescheduleLogs = (
      await client.query('DELETE FROM "BookingRescheduleLog"')
    ).rowCount;
    deleted.bookingStatusHistory = (
      await client.query('DELETE FROM "BookingStatusHistory"')
    ).rowCount;
    deleted.bookingActionTokens = (
      await client.query('DELETE FROM "BookingActionToken"')
    ).rowCount;
    deleted.relatedEmailLogs = (
      await client.query(`
        DELETE FROM "EmailLog"
        WHERE "bookingId" IS NOT NULL
           OR "clientId" IS NOT NULL
           OR "actionTokenId" IS NOT NULL
      `)
    ).rowCount;
    deleted.relatedSubmissionLogs = (
      await client.query(`
        DELETE FROM "BookingSubmissionLog"
        WHERE "bookingId" IS NOT NULL
           OR "clientId" IS NOT NULL
           OR "slotId" IS NOT NULL
      `)
    ).rowCount;
    deleted.bookings = (await client.query('DELETE FROM "Booking"')).rowCount;
    deleted.availabilitySlotServices = (
      await client.query('DELETE FROM "AvailabilitySlotService"')
    ).rowCount;
    deleted.availabilitySlots = (
      await client.query('DELETE FROM "AvailabilitySlot"')
    ).rowCount;
    await client.query("COMMIT");

    return deleted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    exitWithError("DATABASE_URL není nastavené. Nelze vyčistit booking data.");
  }

  const { dryRun, confirm, testDatabase, expectedCounts } = parseArgs(process.argv.slice(2));

  if (process.env.NODE_ENV === "production") {
    exitWithError("Booking cleanup je v NODE_ENV=production zakázaný.");
  }

  if (confirm && (!testDatabase || !expectedCounts || typeof expectedCounts !== "object")) {
    exitWithError('Ostrý běh vyžaduje --test-database <název> a --expect-counts \'{"bookings":0,"availability_slots":0}\'.');
  }

  const client = new Client({
    connectionString: withUtcPostgresTimezone(process.env.DATABASE_URL),
  });

  await client.connect();

  try {
    const identity = await client.query("SELECT current_database() AS database_name");
    const databaseName = identity.rows[0].database_name;
    if (
      confirm &&
      (databaseName !== testDatabase ||
        !/(^|[_-])(test|testing|dev|development|local|sandbox)([_-]|$)/i.test(databaseName) ||
        /(^|[_-])(prod|production)([_-]|$)/i.test(databaseName))
    ) {
      exitWithError(`Odmítnuto: připojená databáze „${databaseName}“ neodpovídá bezpečně identifikované testovací databázi.`);
    }

    const counts = await loadCounts(client);

    console.log("Booking cleanup summary:");
    console.log(formatCount("rezervace", counts.bookings));
    console.log(formatCount("sloty", counts.availability_slots));
    console.log(formatCount("vazby slot-služba", counts.availability_slot_services));
    console.log(formatCount("booking tokeny", counts.booking_action_tokens));
    console.log(formatCount("historie stavů", counts.booking_status_history));
    console.log(formatCount("logy přesunů", counts.booking_reschedule_logs));
    console.log(formatCount("navázané email logy", counts.related_email_logs));
    console.log(formatCount("navázané submission logy", counts.related_submission_logs));
    console.log(formatCount("osiřelé klientky", counts.orphan_clients));

    if (confirm) {
      const actual = {
        bookings: counts.bookings,
        availability_slots: counts.availability_slots,
        availability_slot_services: counts.availability_slot_services,
        booking_action_tokens: counts.booking_action_tokens,
        booking_status_history: counts.booking_status_history,
        booking_reschedule_logs: counts.booking_reschedule_logs,
        related_email_logs: counts.related_email_logs,
        related_submission_logs: counts.related_submission_logs,
      };
      if (
        Object.keys(actual).length !== Object.keys(expectedCounts).length ||
        Object.entries(actual).some(([key, value]) => expectedCounts[key] !== value)
      ) {
        exitWithError(`Odmítnuto: skutečné počty neodpovídají --expect-counts. Skutečnost: ${JSON.stringify(actual)}`);
      }
    }

    if (dryRun || !confirm) {
      console.log("");
      console.log("Dry run only, nic nebylo smazáno.");
      console.log("Ostrý běh vyžaduje --confirm, --test-database <název> a přesné --expect-counts z tohoto přehledu.");
      return;
    }

    const deleted = await deleteBookingData(client);

    console.log("");
    console.log("Booking data cleanup hotový:");
    console.log(formatCount("smazané rezervace", deleted.bookings ?? 0));
    console.log(formatCount("smazané sloty", deleted.availabilitySlots ?? 0));
    console.log(formatCount("smazané vazby slot-služba", deleted.availabilitySlotServices ?? 0));
    console.log(formatCount("smazané booking tokeny", deleted.bookingActionTokens ?? 0));
    console.log(formatCount("smazaná historie stavů", deleted.bookingStatusHistory ?? 0));
    console.log(formatCount("smazané logy přesunů", deleted.bookingRescheduleLogs ?? 0));
    console.log(formatCount("smazané navázané email logy", deleted.relatedEmailLogs ?? 0));
    console.log(formatCount("smazané navázané submission logy", deleted.relatedSubmissionLogs ?? 0));
    console.log(formatCount("smazané osiřelé klientky", deleted.orphanClients ?? 0));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  exitWithError("Booking cleanup selhal.", error instanceof Error ? error.stack : String(error));
});
