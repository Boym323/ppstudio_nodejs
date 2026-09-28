import "dotenv/config";

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const SMOKE_DB_NAME = "ppstudio_voucher_bootstrap";
const SMOKE_STORAGE = "/tmp/ppstudio-voucher-first-rollout";

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} skončil s kódem ${result.status ?? "unknown"}.`);
  }
}

function databaseUrls() {
  const base = new URL(
    process.env.DATABASE_URL
      ?? "postgresql://postgres:postgres@127.0.0.1:5432/ppstudio?schema=public",
  );
  const admin = new URL(base);
  admin.pathname = "/postgres";
  admin.search = "";

  const smoke = new URL(base);
  smoke.pathname = `/${SMOKE_DB_NAME}`;
  smoke.searchParams.set("schema", "public");
  return { admin: admin.toString(), smoke: smoke.toString() };
}

async function resetSmokeDatabase(adminUrl: string) {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${SMOKE_DB_NAME}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${SMOKE_DB_NAME}"`);
  } finally {
    await client.end();
  }
}

async function dropSmokeDatabase(adminUrl: string) {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${SMOKE_DB_NAME}" WITH (FORCE)`);
  } finally {
    await client.end();
  }
}

async function main() {
  const { admin, smoke } = databaseUrls();
  await resetSmokeDatabase(admin);
  await rm(SMOKE_STORAGE, { recursive: true, force: true });

  process.env.DATABASE_URL = smoke;
  process.env.MEDIA_STORAGE_ROOT = SMOKE_STORAGE;
  process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
  process.env.ADMIN_SESSION_SECRET ??= "voucher-first-rollout-smoke-secret-32-characters";

  const smokeEnv = { ...process.env, DATABASE_URL: smoke, MEDIA_STORAGE_ROOT: SMOKE_STORAGE };
  run("npx", ["prisma", "migrate", "deploy"], smokeEnv);
  run("npx", ["prisma", "generate"], smokeEnv);

  const [
    { AdminRole, VoucherStatus, VoucherType },
    { prisma },
    { bootstrapVoucherTemplates },
    { createVoucherPrintBatch, receiveVoucherPrintBatch, activateVoucherStockItem },
    { requireVoucherTemplateById, resolveVoucherTemplate },
    { generateResolvedVoucherBatchPrintPdf },
    { preflightFinalVoucherPrint },
    { verifyVoucherPublic },
  ] = await Promise.all([
    import("@/generated/prisma/client"),
    import("@/lib/prisma"),
    import("@/features/vouchers/lib/voucher-template-bootstrap"),
    import("@/features/vouchers/lib/voucher-stock"),
    import("@/features/vouchers/lib/voucher-template-repository"),
    import("@/features/vouchers/lib/voucher-pdf"),
    import("@/features/vouchers/lib/voucher-template-preflight"),
    import("@/features/vouchers/lib/voucher-validation"),
  ]);

  try {
    const owner = await prisma.adminUser.create({
      data: {
        email: "voucher-first-rollout@example.test",
        name: "Voucher first rollout",
        role: AdminRole.OWNER,
        isActive: true,
      },
    });

    await prisma.siteSettings.create({
      data: {
        id: "site-settings",
        salonName: "PP Studio",
        addressLine: "Sadová 2",
        city: "Zlín",
        postalCode: "760 01",
        phone: "+420 732 856 036",
        contactEmail: "info@ppstudio.cz",
        notificationAdminEmail: owner.email,
        emailSenderName: "PP Studio",
        emailSenderEmail: "info@ppstudio.cz",
      },
    });

    const legacyVoucher = await prisma.voucher.create({
      data: {
        code: "PP-2026-LEGACY",
        type: VoucherType.VALUE,
        templateKey: "classic-v1",
        templateId: null,
        status: VoucherStatus.ACTIVE,
        originalValueCzk: 1000,
        remainingValueCzk: 1000,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: new Date("2027-12-31T23:59:59.999Z"),
        issuedAt: new Date("2026-01-01T00:00:00.000Z"),
        renderPolicy: null,
        createdByUserId: owner.id,
      },
    });

    const bootstrap = await bootstrapVoucherTemplates();
    assert.equal(bootstrap.remainingNulls, 0);
    assert.equal(bootstrap.backfilledVouchers, 1);

    const [legacyTemplate, currentTemplate, settings, backfilledVoucher] = await Promise.all([
      prisma.voucherTemplate.findUniqueOrThrow({ where: { key: "classic-v1" } }),
      prisma.voucherTemplate.findUniqueOrThrow({ where: { key: "classic-v2" } }),
      prisma.siteSettings.findUniqueOrThrow({ where: { id: "site-settings" } }),
      prisma.voucher.findUniqueOrThrow({ where: { id: legacyVoucher.id } }),
    ]);

    assert.equal(legacyTemplate.status, "INACTIVE");
    assert.equal(legacyTemplate.validationPolicy, null);
    assert.equal(currentTemplate.status, "PUBLISHED");
    assert.equal(currentTemplate.validationPolicy, "STRICT_V1");
    assert.equal(settings.voucherDefaultTemplateId, currentTemplate.id);
    assert.equal(backfilledVoucher.templateId, legacyTemplate.id);
    assert.equal(backfilledVoucher.templateKey, "classic-v1");
    assert.equal(backfilledVoucher.renderPolicy, null);

    const category = await prisma.serviceCategory.create({
      data: { name: "Smoke", slug: "voucher-first-rollout-smoke" },
    });
    const service = await prisma.service.create({
      data: {
        categoryId: category.id,
        name: "Smoke služba",
        publicName: "Smoke služba",
        slug: "voucher-first-rollout-smoke-service",
        durationMinutes: 60,
        priceFromCzk: 1500,
        isActive: true,
        isPubliclyBookable: true,
      },
    });

    const batch = await createVoucherPrintBatch({
      templateKey: "classic-v2",
      quantity: 2,
      createdByUserId: owner.id,
      now: new Date("2026-09-28T12:00:00.000Z"),
    });
    const items = await prisma.voucherStockItem.findMany({
      where: { batchId: batch.id },
      orderBy: { sequenceNumber: "asc" },
    });
    assert.equal(items.length, 2);

    const resolvedTemplate = await resolveVoucherTemplate(
      await requireVoucherTemplateById(currentTemplate.id),
    );
    const stockPdf = await generateResolvedVoucherBatchPrintPdf(
      {
        batchNumber: batch.batchNumber,
        items: items.map((item) => ({ code: item.code })),
      },
      resolvedTemplate,
      { requirePrepress: true },
    );
    const stockPreflight = await preflightFinalVoucherPrint(stockPdf, 2);
    assert.deepEqual(stockPreflight.errors, []);
    assert.equal(stockPreflight.geometryValid, true);
    assert.equal(stockPreflight.pdfXMetadataValid, true);
    assert.equal(stockPreflight.iccProfileValid, true);

    await receiveVoucherPrintBatch({
      batchId: batch.id,
      actorUserId: owner.id,
      now: new Date("2026-09-28T12:05:00.000Z"),
    });

    const valueActivation = await activateVoucherStockItem({
      code: items[0]!.code,
      type: VoucherType.VALUE,
      originalValueCzk: 2000,
      actorUserId: owner.id,
      validityMonths: 12,
      now: new Date("2026-09-28T12:10:00.000Z"),
    });
    assert.equal(valueActivation.kind, "activated");

    const serviceActivation = await activateVoucherStockItem({
      code: items[1]!.code,
      type: VoucherType.SERVICE,
      serviceId: service.id,
      actorUserId: owner.id,
      validityMonths: 12,
      now: new Date("2026-09-28T12:11:00.000Z"),
    });
    assert.equal(serviceActivation.kind, "activated");

    const [valueVerification, serviceVerification] = await Promise.all([
      verifyVoucherPublic({ code: items[0]!.code, now: new Date("2026-09-29T12:00:00.000Z") }),
      verifyVoucherPublic({ code: items[1]!.code, now: new Date("2026-09-29T12:00:00.000Z") }),
    ]);
    assert.equal(valueVerification.ok, true);
    assert.equal(serviceVerification.ok, true);

    const secondBootstrap = await bootstrapVoucherTemplates();
    assert.equal(secondBootstrap.remainingNulls, 0);
    assert.equal(secondBootstrap.backfilledVouchers, 0);
    assert.equal(secondBootstrap.defaultTemplateId, currentTemplate.id);

    console.info("Voucher production first-rollout smoke: PASS", {
      legacyTemplate: legacyTemplate.key,
      currentTemplate: currentTemplate.key,
      batchNumber: batch.batchNumber,
      pages: items.length,
    });
  } finally {
    await prisma.$disconnect();
    await rm(SMOKE_STORAGE, { recursive: true, force: true });
    await dropSmokeDatabase(admin);
  }
}

main().catch((error) => {
  console.error("Voucher production first-rollout smoke: FAIL", error);
  process.exitCode = 1;
});
