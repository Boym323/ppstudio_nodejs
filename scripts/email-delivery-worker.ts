import "dotenv/config";

import {
  runBookingReminderSchedulerOnce,
  runEmailDeliveryWorkerOnce,
  startEmailDeliveryWorker,
} from "@/lib/email/worker";

async function main() {
  const once = process.argv.includes("--once");

  if (once) {
    await runBookingReminderSchedulerOnce();
    const processed = await runEmailDeliveryWorkerOnce();
    console.log(`Processed ${processed} email jobs.`);
    return;
  }

  await startEmailDeliveryWorker();
}

main().catch((error) => {
  console.error("Email delivery worker failed", error);
  process.exitCode = 1;
});
