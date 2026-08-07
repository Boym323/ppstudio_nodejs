import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { BookingSubmissionOutcome } from "@prisma/client";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("admin logy rozliší submission typy, Pozornost a SALON scope", async () => {
  const [{ prisma }, { getAdminLogsData }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-data"),
  ]);
  const suffix = `admin-logs-${randomUUID()}`;

  try {
    await prisma.bookingSubmissionLog.createMany({
      data: [
        { outcome: BookingSubmissionOutcome.FAILED, failureCode: "ADMIN_LOGIN_INVALID_CREDENTIALS", failureReason: `Neplatný login ${suffix}` },
        { outcome: BookingSubmissionOutcome.FAILED, failureCode: "PUBLIC_VOUCHER_VERIFY_PUBLIC_PAGE_NOT_FOUND_OR_INVALID", failureReason: `Neplatný voucher ${suffix}` },
        { outcome: BookingSubmissionOutcome.FAILED, failureCode: "VALIDATION_ERROR", failureReason: `Běžná validace ${suffix}` },
        { outcome: BookingSubmissionOutcome.FAILED, failureCode: "UNEXPECTED_ERROR", failureReason: `Kritická chyba ${suffix}` },
      ],
    });

    const system = await getAdminLogsData({ area: "owner", view: "system", query: suffix });
    assert.deepEqual(new Set(system.items.map((item) => item.title)), new Set([
      "Přihlášení administrátora",
      "Veřejné ověření voucheru",
      "Odeslání rezervace selhalo",
    ]));
    assert.equal(system.items.find((item) => item.description?.startsWith("Neplatný login"))?.severity, "info");
    assert.equal(system.items.find((item) => item.description?.startsWith("Kritická chyba"))?.severity, "error");

    const systemInfo = await getAdminLogsData({ area: "owner", view: "system", query: suffix, severity: "info" });
    assert.equal(systemInfo.items.length, 3);
    assert.equal(systemInfo.items.every((item) => item.severity === "info"), true);
    const systemErrors = await getAdminLogsData({ area: "owner", view: "system", query: suffix, severity: "error" });
    assert.deepEqual(systemErrors.items.map((item) => item.description), [`Kritická chyba ${suffix}`]);

    const attention = await getAdminLogsData({ area: "owner", view: "attention", query: suffix });
    assert.deepEqual(attention.items.map((item) => item.description), [`Kritická chyba ${suffix}`]);
    assert.ok(attention.attention.critical >= 1);

    const salonAttention = await getAdminLogsData({ area: "salon", view: "attention", query: suffix });
    assert.equal(salonAttention.items.some((item) => item.sourceType === "submission"), false);
    assert.equal(salonAttention.attention.critical, 0);
  } finally {
    await prisma.bookingSubmissionLog.deleteMany({ where: { failureReason: { contains: suffix } } });
  }
});
