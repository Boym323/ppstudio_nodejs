import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before, describe } from "node:test";

import { AdminRole, VoucherStatus, VoucherType } from "@prisma/client";

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

type TestContext = {
  suffix: string;
  ownerUserId: string;
  salonUserId: string;
};

let seed: TestContext | null = null;

async function loadModules() {
  const [{ prisma }, voucherOperationsModule, voucherReadModelsModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./voucher-operations"),
    import("./voucher-read-models"),
  ]);

  return {
    prisma,
    updateVoucherOperationalDetails: voucherOperationsModule.updateVoucherOperationalDetails,
    cancelVoucherOperationally: voucherOperationsModule.cancelVoucherOperationally,
    VoucherOperationError: voucherOperationsModule.VoucherOperationError,
    voucherOperationErrorCodes: voucherOperationsModule.voucherOperationErrorCodes,
    getVoucherDetail: voucherReadModelsModule.getVoucherDetail,
  };
}

async function createSeed(): Promise<TestContext> {
  const { prisma } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const [owner, salon] = await Promise.all([
    prisma.adminUser.create({
      data: {
        email: `voucher-owner-${suffix}@example.com`,
        name: "Voucher Owner",
        role: AdminRole.OWNER,
      },
    }),
    prisma.adminUser.create({
      data: {
        email: `voucher-salon-${suffix}@example.com`,
        name: "Voucher Salon",
        role: AdminRole.SALON,
      },
    }),
  ]);

  return {
    suffix,
    ownerUserId: owner.id,
    salonUserId: salon.id,
  };
}

async function cleanupSeed(context: TestContext) {
  const { prisma } = await loadModules();

  await prisma.voucherRedemption.deleteMany({
    where: {
      voucher: {
        code: {
          startsWith: `PP-OPS-${context.suffix}`,
        },
      },
    },
  });
  await prisma.voucher.deleteMany({
    where: {
      code: {
        startsWith: `PP-OPS-${context.suffix}`,
      },
    },
  });
  await prisma.adminUser.deleteMany({ where: { id: { in: [context.ownerUserId, context.salonUserId] } } });
}

async function createValueVoucher(context: TestContext, overrides: Partial<{
  status: VoucherStatus;
  remainingValueCzk: number;
  originalValueCzk: number;
}> = {}) {
  const { prisma } = await loadModules();
  const originalValueCzk = overrides.originalValueCzk ?? 1500;

  return prisma.voucher.create({
    data: {
      code: `PP-OPS-${context.suffix}-${randomUUID().slice(0, 6).toUpperCase()}`,
      type: VoucherType.VALUE,
      status: overrides.status ?? VoucherStatus.ACTIVE,
      purchaserName: "Původní kupující",
      purchaserEmail: "puvodni@example.com",
      originalValueCzk,
      remainingValueCzk: overrides.remainingValueCzk ?? originalValueCzk,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: new Date("2026-12-31T00:00:00.000Z"),
      internalNote: null,
      createdByUserId: context.ownerUserId,
    },
  });
}

before(async () => {
  if (process.env.RUN_DB_INTEGRATION_TESTS === "1") {
    seed = await createSeed();
  }
});

after(async () => {
  if (seed) {
    await cleanupSeed(seed);
  }
});

describe("voucher operational management", () => {
  dbTest("OWNER can update only operational voucher details", async () => {
    assert.ok(seed);
    const { prisma, updateVoucherOperationalDetails } = await loadModules();
    const voucher = await createValueVoucher(seed);

    await updateVoucherOperationalDetails({
      voucherId: voucher.id,
      purchaserName: "Marie Nová",
      purchaserEmail: "marie.nova@example.com",
      validUntil: new Date("2027-01-31T00:00:00.000Z"),
      internalNote: "Interní poznámka",
      updatedByUserId: seed.ownerUserId,
    });

    const updated = await prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id } });
    assert.equal(updated.purchaserName, "Marie Nová");
    assert.equal(updated.purchaserEmail, "marie.nova@example.com");
    assert.equal(updated.internalNote, "Interní poznámka");
    assert.equal(updated.updatedByUserId, seed.ownerUserId);
    assert.equal(updated.code, voucher.code);
    assert.equal(updated.type, VoucherType.VALUE);
    assert.equal(updated.originalValueCzk, 1500);
  });

  dbTest("SALON can update operational voucher details", async () => {
    assert.ok(seed);
    const { prisma, updateVoucherOperationalDetails } = await loadModules();
    const voucher = await createValueVoucher(seed);

    await updateVoucherOperationalDetails({
      voucherId: voucher.id,
      purchaserEmail: "salon-oprava@example.com",
      validUntil: null,
      updatedByUserId: seed.salonUserId,
    });

    const updated = await prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id } });
    assert.equal(updated.purchaserEmail, "salon-oprava@example.com");
    assert.equal(updated.validUntil, null);
    assert.equal(updated.updatedByUserId, seed.salonUserId);
    assert.equal(updated.recipientName, null);
    assert.equal(updated.message, null);
  });

  dbTest("OWNER can cancel active voucher without redemptions", async () => {
    assert.ok(seed);
    const { cancelVoucherOperationally } = await loadModules();
    const voucher = await createValueVoucher(seed);

    const cancelled = await cancelVoucherOperationally({
      voucherId: voucher.id,
      cancelReason: "Chybně vystavený voucher",
      actorUserId: seed.ownerUserId,
      now: new Date("2026-05-02T12:20:00.000Z"),
    });

    assert.equal(cancelled.status, VoucherStatus.CANCELLED);
    assert.equal(cancelled.cancelledAt?.toISOString(), "2026-05-02T12:20:00.000Z");
    assert.equal(cancelled.cancelledByUserId, seed.ownerUserId);
    assert.equal(cancelled.updatedByUserId, seed.ownerUserId);
    assert.equal(cancelled.cancelReason, "Chybně vystavený voucher");
  });

  dbTest("SALON can cancel active voucher without redemptions", async () => {
    assert.ok(seed);
    const { cancelVoucherOperationally } = await loadModules();
    const voucher = await createValueVoucher(seed);

    const cancelled = await cancelVoucherOperationally({
      voucherId: voucher.id,
      cancelReason: "Duplicitní vystavení",
      actorUserId: seed.salonUserId,
    });

    assert.equal(cancelled.status, VoucherStatus.CANCELLED);
    assert.equal(cancelled.cancelledByUserId, seed.salonUserId);
    assert.equal(cancelled.cancelReason, "Duplicitní vystavení");
  });

  dbTest("cancelled voucher cannot be cancelled twice", async () => {
    assert.ok(seed);
    const context = seed;
    const { cancelVoucherOperationally, VoucherOperationError, voucherOperationErrorCodes } = await loadModules();
    const voucher = await createValueVoucher(context, { status: VoucherStatus.CANCELLED });

    await assert.rejects(
      () =>
        cancelVoucherOperationally({
          voucherId: voucher.id,
          cancelReason: "Opakované zrušení",
          actorUserId: context.ownerUserId,
        }),
      (error) =>
        error instanceof VoucherOperationError &&
        error.code === voucherOperationErrorCodes.voucherAlreadyCancelled,
    );
  });

  dbTest("partially or fully redeemed voucher cannot be cancelled", async () => {
    assert.ok(seed);
    const context = seed;
    const { prisma, cancelVoucherOperationally, VoucherOperationError, voucherOperationErrorCodes } = await loadModules();
    const partiallyRedeemed = await createValueVoucher(context, {
      status: VoucherStatus.PARTIALLY_REDEEMED,
      remainingValueCzk: 900,
    });
    const redeemed = await createValueVoucher(context, {
      status: VoucherStatus.REDEEMED,
      remainingValueCzk: 0,
    });
    await prisma.voucherRedemption.create({
      data: {
        voucherId: partiallyRedeemed.id,
        amountCzk: 600,
        redeemedByUserId: context.ownerUserId,
      },
    });

    for (const voucher of [partiallyRedeemed, redeemed]) {
      await assert.rejects(
        () =>
          cancelVoucherOperationally({
            voucherId: voucher.id,
            cancelReason: "Nelze zrušit čerpaný voucher",
            actorUserId: context.ownerUserId,
          }),
        (error) =>
          error instanceof VoucherOperationError &&
          error.code === voucherOperationErrorCodes.voucherHasRedemptions,
      );
    }
  });

  dbTest("admin detail exposes cancellation reason for cancelled voucher", async () => {
    assert.ok(seed);
    const { cancelVoucherOperationally, getVoucherDetail } = await loadModules();
    const voucher = await createValueVoucher(seed);

    await cancelVoucherOperationally({
      voucherId: voucher.id,
      cancelReason: "Chybně vystavený voucher",
      actorUserId: seed.ownerUserId,
    });

    const detail = await getVoucherDetail(voucher.id);
    assert.ok(detail);
    assert.equal(detail.cancelReason, "Chybně vystavený voucher");
    assert.equal(detail.cancelledByUser?.id, seed.ownerUserId);
  });
});
