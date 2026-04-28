import assert from "node:assert/strict";
import test from "node:test";

import { MediaAssetVisibility, MediaStorageProvider, VoucherStatus, VoucherType } from "@prisma/client";
import { PDFDocument } from "pdf-lib";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.NEXT_PUBLIC_SITE_DOMAIN ??= "ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

test("builds voucher PDF metadata helpers", async () => {
  const { buildVoucherPdfFilename, buildVoucherVerificationUrl } = await import("./voucher-pdf-core");

  assert.equal(buildVoucherPdfFilename("PP-2026-A7K9X2"), "voucher-PP-2026-A7K9X2.pdf");
  assert.equal(
    buildVoucherVerificationUrl("PP-2026-A7K9X2", "https://ppstudio.cz"),
    "https://ppstudio.cz/vouchery/overeni?code=PP-2026-A7K9X2",
  );
});

test("generates a PDF document for a value voucher", async () => {
  const { generateVoucherPdf } = await import("./voucher-pdf-core");
  const pdfBytes = await generateVoucherPdf(buildVoucherFixture());

  assert.equal(Buffer.from(pdfBytes).subarray(0, 4).toString("utf8"), "%PDF");
  assert.ok(pdfBytes.length > 1_000);
});

test("generates a PDF document for a service voucher", async () => {
  const { generateVoucherPdf } = await import("./voucher-pdf-core");
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
  const { resolveVoucherPdfLogo, VOUCHER_PDF_TEXT_LOGO } = await import("./voucher-pdf-core");
  const logo = await resolveVoucherPdfLogo(null);

  assert.deepEqual(logo, { kind: "text", text: VOUCHER_PDF_TEXT_LOGO });
});

test("generates a PDF when configured voucher logo file is missing", async () => {
  const { generateVoucherPdf } = await import("./voucher-pdf-core");
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
  process.env.VOUCHER_PUBLIC_DOMAIN = "ppstudio.cz";
  const { buildVoucherPdfContactLines } = await import("./voucher-pdf-core");

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
  const { buildVoucherPdfTerms } = await import("./voucher-pdf-core");
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
  const { generateVoucherPdf } = await import("./voucher-pdf-core");
  const pdfBytes = await generateVoucherPdf(
    buildVoucherFixture({
      internalNote: "TOTO NESMI BYT VE VYSTUPU",
    }),
  );
  const payload = Buffer.from(pdfBytes).toString("latin1");

  assert.doesNotMatch(payload, /TOTO NESMI BYT VE VYSTUPU/);
});

test("keeps the existing voucher PDF generator available for email and regular download", async () => {
  const voucherPdfCore = await import("./voucher-pdf-core");

  assert.equal(typeof voucherPdfCore.generateVoucherPdf, "function");
  assert.equal(typeof voucherPdfCore.buildVoucherPdfFilename, "function");
});

test("builds A4 print voucher slots with expected millimetre dimensions", async () => {
  const {
    A4_HEIGHT_PT,
    A4_WIDTH_PT,
    SLOT_HEIGHT_PT,
    SLOT_WIDTH_PT,
    getVoucherPrintSlotBox,
    mm,
    topSlotBottomY,
  } = await import("./voucher-print-a4-pdf-core");

  assert.equal(Math.round(A4_WIDTH_PT * 100), Math.round(mm(210) * 100));
  assert.equal(Math.round(A4_HEIGHT_PT * 100), Math.round(mm(297) * 100));
  assert.equal(Math.round(SLOT_WIDTH_PT * 100), Math.round(mm(210) * 100));
  assert.equal(Math.round(SLOT_HEIGHT_PT * 100), Math.round(mm(99) * 100));
  assert.equal(Math.round(topSlotBottomY * 100), Math.round(mm(198) * 100));
  assert.equal(Math.round(getVoucherPrintSlotBox().y * 100), Math.round(mm(198) * 100));
});

test("generates an A4 print PDF for the top voucher position", async () => {
  const { A4_HEIGHT_PT, A4_WIDTH_PT, generateVoucherPrintA4Pdf } = await import("./voucher-print-a4-pdf-core");

  const pdfBytes = await generateVoucherPrintA4Pdf(buildVoucherFixture(), { logoAsset: null });
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(0);
  const size = page.getSize();

  assert.equal(Buffer.from(pdfBytes).subarray(0, 4).toString("utf8"), "%PDF");
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(Math.round(size.width * 100), Math.round(A4_WIDTH_PT * 100));
  assert.equal(Math.round(size.height * 100), Math.round(A4_HEIGHT_PT * 100));
});

test("A4 print voucher generator has no required position parameter", async () => {
  const { generateVoucherPrintA4Pdf } = await import("./voucher-print-a4-pdf-core");

  assert.equal(generateVoucherPrintA4Pdf.length, 1);
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
    type: VoucherType.VALUE as VoucherType,
    status: VoucherStatus.ACTIVE as VoucherStatus,
    effectiveStatus: VoucherStatus.ACTIVE as VoucherStatus,
    typeLabel: "Hodnotový poukaz",
    statusLabel: "Aktivní",
    valueLabel: "1 500 Kč",
    remainingLabel: "1 500 Kč",
    originalValueCzk: 1500,
    remainingValueCzk: 1500,
    serviceId: null,
    serviceNameSnapshot: null as string | null,
    servicePriceSnapshotCzk: null as number | null,
    serviceDurationSnapshot: null as number | null,
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
    emailHistory: [],
  };
}
