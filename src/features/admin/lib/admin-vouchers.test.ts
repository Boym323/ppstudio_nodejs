import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("create form používá defaultní vzhled a platnost ze SiteSettings", async () => {
  const { buildVoucherCreateInitialValues } = await import("./admin-vouchers");
  const values = buildVoucherCreateInitialValues(new Date("2026-09-16T10:00:00.000Z"), {
    voucherDefaultTemplateKey: "classic-v1",
    voucherDefaultValidityMonths: 12,
  });

  assert.equal(values.templateKey, "classic-v1");
  assert.equal(values.validFrom, "2026-09-16");
  assert.equal(values.validUntil, "2027-09-16");
});

test("výchozí platnost zachová kalendářní měsíc i na konci měsíce", async () => {
  const { buildVoucherCreateInitialValues } = await import("./admin-vouchers");
  const values = buildVoucherCreateInitialValues(new Date("2027-01-31T10:00:00.000Z"), {
    voucherDefaultTemplateKey: "classic-v1",
    voucherDefaultValidityMonths: 1,
  });

  assert.equal(values.validUntil, "2027-02-28");
});

test("výchozí platnost admin create zachová 29. únor jako pražský kalendářní clamp", async () => {
  const { buildVoucherCreateInitialValues } = await import("./admin-vouchers");
  const values = buildVoucherCreateInitialValues(new Date("2024-02-29T10:00:00.000Z"), {
    voucherDefaultTemplateKey: "classic-v1",
    voucherDefaultValidityMonths: 12,
  });

  assert.equal(values.validFrom, "2024-02-29");
  assert.equal(values.validUntil, "2025-02-28");
});

test("create model a nastavení používají všechny aktivní template definitions", async () => {
  const { buildVoucherCreateInitialValues } = await import("./admin-vouchers");
  const { getAdminVoucherTemplateOptions } = await import("./admin-settings-page-data");
  const { createVoucherTemplateRegistry, requireVoucherTemplate } = await import("@/features/vouchers/lib/voucher-template-registry");
  const { VoucherType } = await import("@/generated/prisma/browser");
  const classic = requireVoucherTemplate("classic-v1");
  const registry = createVoucherTemplateRegistry([
    classic,
    {
      ...classic,
      key: "test-template-v1",
      label: "Testovací",
      allowedTypes: [VoucherType.SERVICE],
    },
  ]);

  const values = buildVoucherCreateInitialValues(
    new Date("2026-09-16T10:00:00.000Z"),
    { voucherDefaultTemplateKey: "test-template-v1", voucherDefaultValidityMonths: 12 },
    registry,
  );

  assert.equal(values.templateKey, "test-template-v1");
  assert.deepEqual(
    getAdminVoucherTemplateOptions(registry).map((template) => template.key),
    ["classic-v1", "test-template-v1"],
  );
});
