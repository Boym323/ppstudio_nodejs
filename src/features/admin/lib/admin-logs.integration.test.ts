import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole, BookingSubmissionOutcome, EmailLogType, ServiceChangeOperation, VoucherChangeOperation, VoucherType } from "@prisma/client";

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

dbTest("admin logy používají české popisky voucheru a název kategorie služby", async () => {
  const [{ prisma }, { getAdminLogsData }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-data"),
  ]);
  const suffix = randomUUID();
  const actor = await prisma.adminUser.create({ data: { email: `admin-log-labels-${suffix}@example.com`, name: "Audit popisků", role: AdminRole.SALON } });
  const previousCategory = await prisma.serviceCategory.create({ data: { name: `Původní kategorie ${suffix}`, slug: `puvodni-${suffix}` } });
  const nextCategory = await prisma.serviceCategory.create({ data: { name: `Nová kategorie ${suffix}`, slug: `nova-${suffix}` } });
  const service = await prisma.service.create({ data: { categoryId: nextCategory.id, name: `Služba ${suffix}`, slug: `sluzba-${suffix}`, durationMinutes: 60 } });
  const voucher = await prisma.voucher.create({ data: { code: `AUDIT-${suffix}`, type: VoucherType.VALUE, originalValueCzk: 1000, remainingValueCzk: 1000 } });

  try {
    await prisma.serviceChangeLog.create({
      data: {
        serviceId: service.id,
        actorUserId: actor.id,
        operation: ServiceChangeOperation.UPDATE_OPERATIONAL_DETAILS,
        before: { categoryId: { categoryId: previousCategory.id, categoryName: previousCategory.name } },
        after: { categoryId: { categoryId: nextCategory.id, categoryName: nextCategory.name } },
      },
    });
    await prisma.voucherChangeLog.create({
      data: { voucherId: voucher.id, actorUserId: actor.id, operation: VoucherChangeOperation.UPDATE_OPERATIONAL_DETAILS, before: { purchaserNameChanged: false, purchaserEmailChanged: false }, after: { purchaserNameChanged: true, purchaserEmailChanged: true } },
    });

    await prisma.serviceCategory.delete({ where: { id: previousCategory.id } });

    const serviceLogs = await getAdminLogsData({ area: "salon", view: "events", source: "service", query: suffix });
    assert.equal(serviceLogs.items[0]?.description, `Kategorie: Původní kategorie ${suffix} → Nová kategorie ${suffix}`);
    const voucherLogs = await getAdminLogsData({ area: "salon", view: "events", source: "voucher", query: suffix });
    assert.equal(voucherLogs.items[0]?.description, "Jméno kupujícího: upraveno • E-mail kupujícího: upraveno");
  } finally {
    await prisma.voucherChangeLog.deleteMany({ where: { voucherId: voucher.id } });
    await prisma.serviceChangeLog.deleteMany({ where: { serviceId: service.id } });
    await prisma.voucher.delete({ where: { id: voucher.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: nextCategory.id } });
    await prisma.adminUser.delete({ where: { id: actor.id } });
  }
});

dbTest("admin logy filtrují a popisují oba lifecycle e-maily rezervace", async () => {
  const [{ prisma }, { getAdminLogsData }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-data"),
  ]);
  const suffix = randomUUID();

  try {
    await prisma.emailLog.createMany({
      data: [
        {
          type: EmailLogType.BOOKING_RECEIVED,
          recipientEmail: `received-${suffix}@example.com`,
          subject: `Přijetí rezervace ${suffix}`,
          templateKey: "booking-confirmation-v1",
        },
        {
          type: EmailLogType.BOOKING_CONFIRMED,
          recipientEmail: `confirmed-${suffix}@example.com`,
          subject: `Potvrzení rezervace ${suffix}`,
          templateKey: "booking-approved-v1",
        },
      ],
    });

    const received = await getAdminLogsData({ area: "owner", view: "emails", query: suffix, emailType: EmailLogType.BOOKING_RECEIVED });
    const confirmed = await getAdminLogsData({ area: "owner", view: "emails", query: suffix, emailType: EmailLogType.BOOKING_CONFIRMED });

    assert.equal(received.items[0]?.title, "Přijetí rezervace");
    assert.equal(confirmed.items[0]?.title, "Potvrzení rezervace");
  } finally {
    await prisma.emailLog.deleteMany({ where: { subject: { contains: suffix } } });
  }
});
