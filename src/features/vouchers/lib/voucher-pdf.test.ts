import assert from "node:assert/strict";
import test from "node:test";

import { MediaAssetVisibility, MediaStorageProvider, VoucherStatus, VoucherType } from "@prisma/client";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

test("builds voucher PDF metadata helpers", async () => {
  const { buildVoucherPdfFilename, buildVoucherVerificationUrl } = await import("./voucher-pdf");

  assert.equal(buildVoucherPdfFilename("PP-2026-A7K9X2"), "voucher-PP-2026-A7K9X2.pdf");
  assert.equal(
    buildVoucherVerificationUrl("PP-2026-A7K9X2", "https://ppstudio.cz"),
    "https://ppstudio.cz/vouchery/overeni?code=PP-2026-A7K9X2",
  );
});

test("generates a PDF document for a value voucher", async () => {
  const { generateVoucherPdf } = await import("./voucher-pdf");
  const pdfBytes = await generateVoucherPdf(buildVoucherFixture());

  assert.equal(Buffer.from(pdfBytes).subarray(0, 4).toString("utf8"), "%PDF");
  assert.ok(pdfBytes.length > 1_000);
});

test("generates a PDF document for a service voucher", async () => {
  const { generateVoucherPdf } = await import("./voucher-pdf");
  const pdfBytes = await generateVoucherPdf(
    buildVoucherFixture({
      type: VoucherType.SERVICE,
      serviceNameSnapshot: "Komplexní hloubkové ošetření pleti s liftingovou masáží a závěrečnou regenerací",
    }),
  );

  assert.equal(Buffer.from(pdfBytes).subarray(0, 4).toString("utf8"), "%PDF");
  assert.ok(pdfBytes.length > 1_000);
});

test("uses text logo fallback when voucher PDF logo is not configured", async () => {
  const { resolveVoucherPdfLogo, VOUCHER_PDF_TEXT_LOGO } = await import("./voucher-pdf");
  const logo = await resolveVoucherPdfLogo(null);

  assert.deepEqual(logo, { kind: "text", text: VOUCHER_PDF_TEXT_LOGO });
});

test("generates a PDF when configured voucher logo file is missing", async () => {
  const { generateVoucherPdf } = await import("./voucher-pdf");
  const pdfBytes = await generateVoucherPdf(buildVoucherFixture(), {
    logoAsset: {
      id: "missing-logo",
      storageProvider: MediaStorageProvider.LOCAL,
      visibility: MediaAssetVisibility.PUBLIC,
      mimeType: "image/png",
      storagePath: "general/2099/01/missing-logo.png",
      optimizedStoragePath: null,
      optimizedMimeType: null,
    },
  });

  assert.equal(Buffer.from(pdfBytes).subarray(0, 4).toString("utf8"), "%PDF");
  assert.ok(pdfBytes.length > 1_000);
});

test("builds voucher PDF contact lines from salon settings", async () => {
  const { buildVoucherPdfContactLines } = await import("./voucher-pdf");
  const lines = buildVoucherPdfContactLines({
    addressLine: "Sadová 2",
    postalCode: "760 01",
    city: "Zlín",
    phone: "+420 732 856 036",
    contactEmail: "info@ppstudio.cz",
  });

  assert.deepEqual(lines, ["Sadová 2, 760 01 Zlín", "+420 732 856 036 · info@ppstudio.cz · ppstudio.cz"]);
});

test("builds voucher PDF terms only for the voucher type", async () => {
  const { buildVoucherPdfTerms } = await import("./voucher-pdf");
  const valueTerms = buildVoucherPdfTerms({ type: VoucherType.VALUE });
  const serviceTerms = buildVoucherPdfTerms({ type: VoucherType.SERVICE });
  const valueText = valueTerms.join(" ");
  const serviceText = serviceTerms.join(" ");

  assert.equal(valueTerms[0], "Poukaz je možné uplatnit při rezervaci nebo osobně v salonu.");
  assert.equal(valueTerms[1], "Poukaz není směnitelný za hotovost.");
  assert.equal(valueTerms[2], "Hodnotový poukaz lze čerpat postupně.");
  assert.equal(serviceTerms[0], "Poukaz je možné uplatnit při rezervaci nebo osobně v salonu.");
  assert.equal(serviceTerms[1], "Poukaz není směnitelný za hotovost.");
  assert.equal(serviceTerms[2], "Poukaz je určený pro uvedenou službu.");
  assert.match(valueText, /čerpat postupně/);
  assert.doesNotMatch(valueText, /uvedenou službu/);
  assert.match(serviceText, /uvedenou službu/);
  assert.doesNotMatch(serviceText, /čerpat postupně/);
});

test("voucher PDF output does not expose internal note in plain text", async () => {
  const { generateVoucherPdf } = await import("./voucher-pdf");
  const pdfBytes = await generateVoucherPdf(
    buildVoucherFixture({
      internalNote: "TOTO NESMI BYT VE VYSTUPU",
    }),
  );
  const payload = Buffer.from(pdfBytes).toString("latin1");

  assert.doesNotMatch(payload, /TOTO NESMI BYT VE VYSTUPU/);
});

function buildVoucherFixture(overrides: Partial<ReturnType<typeof buildBaseVoucherFixture>> = {}) {
  return {
    ...buildBaseVoucherFixture(),
    ...overrides,
  };
}

function buildBaseVoucherFixture() {
  return {
    id: "voucher-test",
    code: "PP-2026-A7K9X2",
    type: VoucherType.VALUE,
    status: VoucherStatus.ACTIVE,
    effectiveStatus: VoucherStatus.ACTIVE,
    typeLabel: "Hodnotový poukaz",
    statusLabel: "Aktivní",
    valueLabel: "1 500 Kč",
    remainingLabel: "1 500 Kč",
    originalValueCzk: 1500,
    remainingValueCzk: 1500,
    serviceId: null,
    serviceNameSnapshot: null,
    servicePriceSnapshotCzk: null,
    serviceDurationSnapshot: null,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validUntil: new Date("2026-12-31T00:00:00.000Z"),
    issuedAt: new Date("2026-01-01T00:00:00.000Z"),
    cancelledAt: null,
    purchaserName: "Marie Kupující",
    purchaserEmail: "marie@example.com",
    recipientName: null,
    message: null,
    internalNote: "Neveřejná poznámka",
    createdByUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    service: null,
    createdByUser: null,
    redemptions: [],
  };
}
