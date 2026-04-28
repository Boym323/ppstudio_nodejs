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
  actorUserId: string;
  categoryId: string;
  serviceId: string;
};

let seed: TestContext | null = null;

async function loadModules() {
  const [{ prisma }, voucherValidationModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./voucher-validation"),
  ]);

  return {
    prisma,
    verifyVoucherPublic: voucherValidationModule.verifyVoucherPublic,
  };
}

async function createSeed(): Promise<TestContext> {
  const { prisma } = await loadModules();
  const suffix = randomUUID().slice(0, 8).toUpperCase();

  const actor = await prisma.adminUser.create({
    data: {
      email: `public-voucher-${suffix.toLowerCase()}@example.com`,
      name: "Public Voucher Tester",
      role: AdminRole.OWNER,
    },
  });
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Public voucher kategorie ${suffix}`,
      slug: `public-voucher-kategorie-${suffix.toLowerCase()}`,
    },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: "Lash lifting interní",
      publicName: "Lash lifting public",
      slug: `public-voucher-lash-${suffix.toLowerCase()}`,
      durationMinutes: 60,
      priceFromCzk: 1200,
    },
  });

  return {
    suffix,
    actorUserId: actor.id,
    categoryId: category.id,
    serviceId: service.id,
  };
}

async function cleanupSeed(context: TestContext) {
  const { prisma } = await loadModules();

  await prisma.voucher.deleteMany({
    where: {
      code: {
        startsWith: `PP-2026-${context.suffix}`,
      },
    },
  });
  await prisma.service.deleteMany({ where: { id: context.serviceId } });
  await prisma.serviceCategory.deleteMany({ where: { id: context.categoryId } });
  await prisma.adminUser.deleteMany({ where: { id: context.actorUserId } });
}

async function createTestVoucher(
  context: TestContext,
  input: {
    codeSuffix: string;
    type: VoucherType;
    status?: VoucherStatus;
    remainingValueCzk?: number | null;
    validUntil?: Date | null;
    purchaserEmail?: string | null;
    internalNote?: string | null;
  },
) {
  const { prisma } = await loadModules();
  const isService = input.type === VoucherType.SERVICE;

  return prisma.voucher.create({
    data: {
      code: `PP-2026-${context.suffix}${input.codeSuffix}`,
      type: input.type,
      status: input.status ?? VoucherStatus.ACTIVE,
      purchaserEmail: input.purchaserEmail ?? null,
      originalValueCzk: isService ? 1200 : 1500,
      remainingValueCzk: isService ? null : (input.remainingValueCzk ?? 1500),
      serviceId: isService ? context.serviceId : null,
      serviceNameSnapshot: isService ? "Lash lifting public" : null,
      servicePriceSnapshotCzk: isService ? 1200 : null,
      serviceDurationSnapshot: isService ? 60 : null,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: input.validUntil === undefined ? new Date("2026-12-31T23:59:59.000Z") : input.validUntil,
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      internalNote: input.internalNote ?? null,
      createdByUserId: context.actorUserId,
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

describe("public voucher verification", () => {
  dbTest("returns safe result for valid VALUE voucher", async () => {
    assert.ok(seed);
    const { verifyVoucherPublic } = await loadModules();
    const voucher = await createTestVoucher(seed, {
      codeSuffix: "VA",
      type: VoucherType.VALUE,
      remainingValueCzk: 900,
      purchaserEmail: "kupujici@example.com",
      internalNote: "Interní poznámka nesmí ven.",
    });

    const result = await verifyVoucherPublic({
      code: voucher.code.toLowerCase(),
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.type, VoucherType.VALUE);
    assert.equal(result.ok && result.code, voucher.code);
    assert.equal(result.ok && result.remainingValueCzk, 900);
    assert.equal(JSON.stringify(result).includes("kupujici@example.com"), false);
    assert.equal(JSON.stringify(result).includes("Interní poznámka"), false);
  });

  dbTest("returns safe result for valid SERVICE voucher", async () => {
    assert.ok(seed);
    const { verifyVoucherPublic } = await loadModules();
    const voucher = await createTestVoucher(seed, {
      codeSuffix: "SE",
      type: VoucherType.SERVICE,
    });

    const result = await verifyVoucherPublic({
      code: voucher.code,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.type, VoucherType.SERVICE);
    assert.equal(result.ok && result.serviceNameSnapshot, "Lash lifting public");
    assert.equal(result.ok && result.remainingValueCzk, null);
  });

  dbTest("returns redeemed reason for REDEEMED voucher", async () => {
    assert.ok(seed);
    const { verifyVoucherPublic } = await loadModules();
    const voucher = await createTestVoucher(seed, {
      codeSuffix: "RE",
      type: VoucherType.VALUE,
      status: VoucherStatus.REDEEMED,
      remainingValueCzk: 0,
    });

    const result = await verifyVoucherPublic({
      code: voucher.code,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    assert.deepEqual(result, { ok: false, reason: "REDEEMED" });
  });

  dbTest("returns expired reason for expired voucher", async () => {
    assert.ok(seed);
    const { verifyVoucherPublic } = await loadModules();
    const voucher = await createTestVoucher(seed, {
      codeSuffix: "EX",
      type: VoucherType.VALUE,
      validUntil: new Date("2026-02-01T00:00:00.000Z"),
    });

    const result = await verifyVoucherPublic({
      code: voucher.code,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });

    assert.deepEqual(result, { ok: false, reason: "EXPIRED" });
  });

  dbTest("does not expose purchaserEmail or internalNote", async () => {
    assert.ok(seed);
    const { verifyVoucherPublic } = await loadModules();
    const voucher = await createTestVoucher(seed, {
      codeSuffix: "PI",
      type: VoucherType.VALUE,
      purchaserEmail: "tajny-email@example.com",
      internalNote: "Tajná interní poznámka",
    });

    const result = await verifyVoucherPublic({
      code: voucher.code,
      now: new Date("2026-06-01T12:00:00.000Z"),
    });
    const serialized = JSON.stringify(result);

    assert.equal(serialized.includes("tajny-email@example.com"), false);
    assert.equal(serialized.includes("Tajná interní poznámka"), false);
  });
});
