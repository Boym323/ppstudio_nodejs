import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { EmailLogType, VoucherStatus, VoucherType } from "@prisma/client";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

async function loadModules() {
  const [{ prisma }, voucherEmailModule] = await Promise.all([
    import("@/lib/prisma"),
    import("@/features/admin/actions/voucher-email-actions"),
  ]);

  return {
    prisma,
    queueVoucherEmailLog: voucherEmailModule.queueVoucherEmailLog,
  };
}

async function createVoucher({
  status,
  validUntil,
  suffix,
}: {
  status: VoucherStatus;
  validUntil: Date | null;
  suffix: string;
}) {
  const { prisma } = await loadModules();

  return prisma.voucher.create({
    data: {
      code: `PP-TEST-${suffix}`,
      type: VoucherType.VALUE,
      status,
      originalValueCzk: 1500,
      remainingValueCzk: 1500,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil,
    },
  });
}

dbTest("queueVoucherEmailLog rejects invalid recipient email", async () => {
  const { queueVoucherEmailLog } = await loadModules();

  const result = await queueVoucherEmailLog({
    voucherId: "voucher-1",
    recipientEmail: "not-an-email",
    subject: "Dárkový poukaz PP Studio",
    message: "Dobrý den, v příloze zasíláme dárkový poukaz PP Studio.",
  });

  assert.equal(result.status, "error");
  assert.match(result.formError, /doplnit nebo opravit/i);
  assert.match(result.fieldErrors?.recipientEmail ?? "", /platný e-mail/i);
});

dbTest("queueVoucherEmailLog rejects non-sendable voucher states", async () => {
  const { prisma, queueVoucherEmailLog } = await loadModules();
  const suffix = randomUUID().slice(0, 8);

  const vouchers = await Promise.all([
    createVoucher({
      status: VoucherStatus.DRAFT,
      validUntil: new Date("2027-01-01T00:00:00.000Z"),
      suffix: `${suffix}a`,
    }),
    createVoucher({
      status: VoucherStatus.REDEEMED,
      validUntil: new Date("2027-01-01T00:00:00.000Z"),
      suffix: `${suffix}b`,
    }),
    createVoucher({
      status: VoucherStatus.CANCELLED,
      validUntil: new Date("2027-01-01T00:00:00.000Z"),
      suffix: `${suffix}c`,
    }),
    createVoucher({
      status: VoucherStatus.ACTIVE,
      validUntil: new Date("2020-01-01T00:00:00.000Z"),
      suffix: `${suffix}d`,
    }),
  ]);

  try {
    for (const voucher of vouchers) {
      const result = await queueVoucherEmailLog({
        voucherId: voucher.id,
        recipientEmail: "recipient@example.com",
        subject: "Dárkový poukaz PP Studio",
        message: "Dobrý den, v příloze zasíláme dárkový poukaz PP Studio.",
      });

      assert.equal(result.status, "error");
      assert.equal(result.formError, "Voucher v tomto stavu nelze odeslat e-mailem.");
    }
  } finally {
    await prisma.voucher.deleteMany({
      where: {
        id: { in: vouchers.map((voucher) => voucher.id) },
      },
    });
  }
});

dbTest("queueVoucherEmailLog enqueues ACTIVE voucher and creates EmailLog entry", async () => {
  const { prisma, queueVoucherEmailLog } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const voucher = await createVoucher({
    status: VoucherStatus.ACTIVE,
    validUntil: new Date("2027-01-01T00:00:00.000Z"),
    suffix,
  });

  try {
    const result = await queueVoucherEmailLog({
      voucherId: voucher.id,
      recipientEmail: "voucher-recipient@example.com",
      subject: "Dárkový poukaz PP Studio",
      message: "Dobrý den, v příloze zasíláme dárkový poukaz PP Studio.",
    });

    assert.equal(result.status, "success");

    const emailLog = await prisma.emailLog.findFirst({
      where: {
        templateKey: "voucher-sent-v1",
        recipientEmail: "voucher-recipient@example.com",
      },
      orderBy: { createdAt: "desc" },
      select: {
        type: true,
        recipientEmail: true,
        payload: true,
      },
    });

    assert.ok(emailLog);
    assert.equal(emailLog.type, EmailLogType.VOUCHER_SENT);
    assert.equal(emailLog.recipientEmail, "voucher-recipient@example.com");
  } finally {
    await prisma.emailLog.deleteMany({
      where: {
        templateKey: "voucher-sent-v1",
        recipientEmail: "voucher-recipient@example.com",
      },
    });
    await prisma.voucher.deleteMany({ where: { id: voucher.id } });
  }
});
