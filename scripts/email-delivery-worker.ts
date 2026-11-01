import "dotenv/config";

import {
  runBookingReminderSchedulerOnce,
  runEmailDeliveryWorkerOnce,
  startEmailDeliveryWorker,
} from "@/lib/email/worker";
import { runMetaConversionWorkerOnce } from "@/lib/analytics/meta-capi-worker";

async function main() {
  const once = process.argv.includes("--once");

  if (once) {
    await runBookingReminderSchedulerOnce();
    const metaResult = await runMetaConversionWorkerOnce();
    const processed = await runEmailDeliveryWorkerOnce();
    console.log(`Processed ${processed} email jobs and ${metaResult.attempted} Meta CAPI events.`);
    return;
  }

  await startEmailDeliveryWorker();
}

main().catch((error) => {
  console.error("Email delivery worker failed", error);
  process.exitCode = 1;
});
