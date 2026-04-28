import assert from "node:assert/strict";
import test from "node:test";

import { VoucherStatus, VoucherType } from "@prisma/client";

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
  const pdfBytes = await generateVoucherPdf({
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
  });

  assert.equal(Buffer.from(pdfBytes).subarray(0, 4).toString("utf8"), "%PDF");
  assert.ok(pdfBytes.length > 1_000);
});
