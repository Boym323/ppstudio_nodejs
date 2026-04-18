import "dotenv/config";

import { startEmailDeliveryWorker, runEmailDeliveryWorkerOnce } from "@/lib/email/worker";

async function main() {
  const once = process.argv.includes("--once");

  if (once) {
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
