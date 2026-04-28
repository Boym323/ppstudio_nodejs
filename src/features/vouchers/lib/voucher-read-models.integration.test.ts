import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { EmailLogStatus, EmailLogType, VoucherStatus, VoucherType } from "@prisma/client";

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
  const [{ prisma }, voucherReadModelsModule, adminVouchersModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./voucher-read-models"),
    import("@/features/admin/lib/admin-vouchers"),
  ]);

  return {
    prisma,
    getVoucherDetail: voucherReadModelsModule.getVoucherDetail,
    getAdminVoucherDetailData: adminVouchersModule.getAdminVoucherDetailData,
  };
}

async function createVoucher(suffix: string) {
  const { prisma } = await loadModules();

  return prisma.voucher.create({
    data: {
      code: `PP-TEST-${suffix}`,
      type: VoucherType.VALUE,
      status: VoucherStatus.ACTIVE,
      originalValueCzk: 1500,
      remainingValueCzk: 1500,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: new Date("2027-01-01T00:00:00.000Z"),
    },
  });
}

async function createVoucherEmailLog({
  voucherId,
  recipientEmail,
  status,
  createdAt,
  sentAt,
  errorMessage,
}: {
  voucherId: string;
  recipientEmail: string;
  status: EmailLogStatus;
  createdAt: Date;
  sentAt?: Date | null;
  errorMessage?: string | null;
}) {
  const { prisma } = await loadModules();

  return prisma.emailLog.create({
    data: {
      type: EmailLogType.VOUCHER_SENT,
      status,
      attemptCount: status === EmailLogStatus.PENDING ? 0 : 1,
      nextAttemptAt: createdAt,
      processingStartedAt: null,
      processingToken: null,
      recipientEmail,
      subject: "Dárkový poukaz PP Studio",
      templateKey: "voucher-sent-v1",
      payload: {
        voucherId,
      },
      provider: status === EmailLogStatus.SENT ? "log" : null,
      sentAt: sentAt ?? null,
      errorMessage: errorMessage ?? null,
      createdAt,
    },
  });
}

dbTest("getVoucherDetail returns empty email history when no voucher email logs exist", async () => {
  const { prisma, getVoucherDetail } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const voucher = await createVoucher(suffix);

  try {
    const detail = await getVoucherDetail(voucher.id);

    assert.ok(detail);
    assert.deepEqual(detail.emailHistory, []);
  } finally {
    await prisma.voucher.deleteMany({ where: { id: voucher.id } });
  }
});

dbTest("getVoucherDetail exposes pending, sent and failed voucher email history safely", async () => {
  const { prisma, getVoucherDetail, getAdminVoucherDetailData } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const voucher = await createVoucher(suffix);
  const base = new Date("2026-04-28T10:00:00.000Z");

  try {
    await createVoucherEmailLog({
      voucherId: voucher.id,
      recipientEmail: `pending-${suffix}@example.com`,
      status: EmailLogStatus.PENDING,
      createdAt: new Date(base.getTime() + 1_000),
    });
    await createVoucherEmailLog({
      voucherId: voucher.id,
      recipientEmail: `sent-${suffix}@example.com`,
      status: EmailLogStatus.SENT,
      createdAt: new Date(base.getTime() + 2_000),
      sentAt: new Date(base.getTime() + 2_000),
    });
    await createVoucherEmailLog({
      voucherId: voucher.id,
      recipientEmail: `failed-${suffix}@example.com`,
      status: EmailLogStatus.FAILED,
      createdAt: new Date(base.getTime() + 3_000),
      errorMessage: "SMTP timeout\nstack trace should not be exposed",
    });

    const detail = await getVoucherDetail(voucher.id);
    const adminDetail = await getAdminVoucherDetailData("owner", voucher.id);

    assert.ok(detail);
    assert.ok(adminDetail);
    assert.equal(detail.emailHistory.length, 3);
    assert.equal(adminDetail.emailHistory.length, 3);
    assert.deepEqual(detail.emailHistory.map((entry) => entry.status), [
      EmailLogStatus.FAILED,
      EmailLogStatus.SENT,
      EmailLogStatus.PENDING,
    ]);
    assert.equal(detail.emailHistory[0].recipientEmail, `failed-${suffix}@example.com`);
    assert.equal(detail.emailHistory[1].recipientEmail, `sent-${suffix}@example.com`);
    assert.equal(detail.emailHistory[2].recipientEmail, `pending-${suffix}@example.com`);
    assert.equal(detail.emailHistory[0].errorMessage, "SMTP timeout");
    assert.equal(detail.emailHistory[1].errorMessage, null);
    assert.equal(detail.emailHistory[2].errorMessage, null);
    assert.equal(detail.emailHistory[0].sentAt, null);
    assert.equal(detail.emailHistory[1].sentAt?.toISOString(), new Date(base.getTime() + 2_000).toISOString());
    assert.equal(detail.emailHistory[2].sentAt, null);
  } finally {
    await prisma.emailLog.deleteMany({
      where: {
        templateKey: "voucher-sent-v1",
        recipientEmail: {
          contains: suffix,
        },
      },
    });
    await prisma.voucher.deleteMany({ where: { id: voucher.id } });
  }
});

dbTest("getVoucherDetail omits payload and technical fields from email history", async () => {
  const { prisma, getVoucherDetail } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const voucher = await createVoucher(suffix);

  try {
    await createVoucherEmailLog({
      voucherId: voucher.id,
      recipientEmail: `safe-${suffix}@example.com`,
      status: EmailLogStatus.SENT,
      createdAt: new Date("2026-04-28T11:00:00.000Z"),
      sentAt: new Date("2026-04-28T11:00:00.000Z"),
    });

    const detail = await getVoucherDetail(voucher.id);

    assert.ok(detail);
    assert.equal(detail.emailHistory.length, 1);
    assert.deepEqual(Object.keys(detail.emailHistory[0]).sort(), [
      "createdAt",
      "errorMessage",
      "id",
      "recipientEmail",
      "sentAt",
      "status",
    ]);
    assert.equal("payload" in detail.emailHistory[0], false);
    assert.equal("processingToken" in detail.emailHistory[0], false);
    assert.equal("providerMessageId" in detail.emailHistory[0], false);
  } finally {
    await prisma.emailLog.deleteMany({
      where: {
        templateKey: "voucher-sent-v1",
        recipientEmail: {
          contains: suffix,
        },
      },
    });
    await prisma.voucher.deleteMany({ where: { id: voucher.id } });
  }
});

dbTest("getVoucherDetail limits voucher email history to five newest records", async () => {
  const { prisma, getVoucherDetail } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const voucher = await createVoucher(suffix);
  const base = new Date("2026-04-28T12:00:00.000Z");

  try {
    await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        createVoucherEmailLog({
          voucherId: voucher.id,
          recipientEmail: `limit-${index}-${suffix}@example.com`,
          status: EmailLogStatus.SENT,
          createdAt: new Date(base.getTime() + index * 1_000),
          sentAt: new Date(base.getTime() + index * 1_000),
        }),
      ),
    );

    const detail = await getVoucherDetail(voucher.id);

    assert.ok(detail);
    assert.equal(detail.emailHistory.length, 5);
    assert.equal(detail.emailHistory[0].recipientEmail, `limit-5-${suffix}@example.com`);
    assert.equal(detail.emailHistory[4].recipientEmail, `limit-1-${suffix}@example.com`);
  } finally {
    await prisma.emailLog.deleteMany({
      where: {
        templateKey: "voucher-sent-v1",
        recipientEmail: {
          contains: suffix,
        },
      },
    });
    await prisma.voucher.deleteMany({ where: { id: voucher.id } });
  }
});
