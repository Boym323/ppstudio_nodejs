import { prisma } from "@/lib/prisma";
import { bootstrapVoucherTemplates } from "@/features/vouchers/lib/voucher-template-bootstrap";

bootstrapVoucherTemplates()
  .then((result) => console.info(`classic-v1 bootstrap dokončen; backfill=${result.backfilledVouchers}; remainingNulls=${result.remainingNulls}.`))
  .catch((error) => {
    console.error("classic-v1 bootstrap selhal", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
