import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { AdminRole } from "@/generated/prisma/client";
import { bootstrapVoucherTemplates } from "@/features/vouchers/lib/voucher-template-bootstrap";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

const ownerEmail = process.env.ADMIN_OWNER_EMAIL ?? "owner@example.com";
const ownerPassword = process.env.ADMIN_OWNER_PASSWORD ?? "change-me-owner";

async function prepareCiVoucherFixtures() {
  const passwordHash = await hashPassword(ownerPassword);

  await prisma.adminUser.upsert({
    where: { email: ownerEmail },
    update: {
      name: "CI Owner",
      passwordHash,
      role: AdminRole.OWNER,
      isActive: true,
    },
    create: {
      email: ownerEmail,
      name: "CI Owner",
      passwordHash,
      role: AdminRole.OWNER,
      isActive: true,
    },
  });

  await prisma.siteSettings.upsert({
    where: { id: "site-settings" },
    update: {},
    create: {
      salonName: "PP Studio",
      addressLine: "Sadová 2",
      city: "Zlín",
      postalCode: "760 01",
      phone: "+420 732 856 036",
      contactEmail: "info@ppstudio.cz",
      bookingMinAdvanceHours: 2,
      bookingMaxAdvanceDays: 90,
      bookingCancellationHours: 24,
      autoLunchEnabled: true,
      notificationAdminEmail: ownerEmail,
      emailSenderName: "PP Studio",
      emailSenderEmail: "info@ppstudio.cz",
    },
  });

  // CI používá legacy key classic-v1 kvůli existujícím fixture scénářům, ale
  // musí testovat současný strict PDF/X master. Historický classic-v1.pdf je
  // záměrně PDF 1.4 a nesmí se kvůli CI ani produkčnímu bootstrapu přepisovat.
  const strictCiMaster = await readFile(path.join(process.cwd(), "src", "features", "vouchers", "bootstrap-assets", "classic-v2.pdf"));
  const result = await bootstrapVoucherTemplates({ readMaster: async () => strictCiMaster });
  console.info(
    `CI voucher fixtures připraveny; backfill=${result.backfilledVouchers}; remainingNulls=${result.remainingNulls}.`,
  );
}

prepareCiVoucherFixtures()
  .catch((error) => {
    console.error("Příprava CI voucher fixtures selhala", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
