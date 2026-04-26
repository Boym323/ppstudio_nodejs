import "dotenv/config";
import { Client } from "pg";

function parseArgs(argv) {
  return {
    dryRun: argv.includes("--dry-run"),
    confirm: argv.includes("--confirm"),
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
    deleted.orphanClients = (
      await client.query(`
        DELETE FROM "Client"
        WHERE NOT EXISTS (
          SELECT 1
          FROM "Booking" b
          WHERE b."clientId" = "Client"."id"
        )
      `)
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

  const { dryRun, confirm } = parseArgs(process.argv.slice(2));

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
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

    if (dryRun || !confirm) {
      console.log("");
      console.log("Dry run only, nic nebylo smazáno.");
      console.log("Pro skutečné smazání spusť: node scripts/clear-booking-data.mjs --confirm");
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
