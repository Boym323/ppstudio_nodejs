import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import test from "node:test";

import { VoucherStatus, VoucherType } from "@/generated/prisma/browser";
import { PDFDocument } from "pdf-lib";

import {
  createVoucherTemplateRegistry,
  requireVoucherTemplate,
} from "@/features/vouchers/lib/voucher-template-registry";

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

test("classic-v1 master existuje ve správné cestě", async () => {
  await access("public/brand/vouchers/classic-v1.pdf");
});

test("overlay data obsahují českou VALUE částku a verification URL", async () => {
  const { buildVoucherPdfOverlayData } = await import("./voucher-pdf-core");
  const data = buildVoucherPdfOverlayData(
    buildVoucherFixture({
      originalValueCzk: 1500,
      servicePriceSnapshotCzk: null,
      serviceNameSnapshot: null,
    }),
  );

  assert.equal(data.templateKey, "classic-v1");
  assert.match(data.value, /1\s500/);
  assert.match(data.value, /Kč/);
  assert.equal(data.validUntil, "16. 9. 2027");
  assert.equal(data.code, "PP-2026-A7K9X2");
  assert.equal(data.verificationUrl, "https://ppstudio.cz/vouchery/overeni?code=PP-2026-A7K9X2");
});

test("overlay data používají snapshot SERVICE názvu včetně diakritiky", async () => {
  const { buildVoucherPdfOverlayData } = await import("./voucher-pdf-core");
  const data = buildVoucherPdfOverlayData(
    buildVoucherFixture({
      type: VoucherType.SERVICE,
      originalValueCzk: null,
      remainingValueCzk: null,
      serviceNameSnapshot: "Korejský Lashlifting",
      servicePriceSnapshotCzk: 1500,
    }),
  );

  assert.equal(data.value, "Korejský Lashlifting");
});

test("overlay ignoruje osobní a interní voucherová pole", async () => {
  const { buildVoucherPdfOverlayData } = await import("./voucher-pdf-core");
  const data = buildVoucherPdfOverlayData(buildVoucherFixture());

  assert.doesNotMatch(JSON.stringify(data), /Marie Kupující|Obdarovaná|Soukromé věnování|Neveřejná poznámka/);
});

test("neznámý templateKey se při renderu odmítne bez fallbacku", async () => {
  const { generateVoucherPrintPdf } = await import("./voucher-pdf-core");

  await assert.rejects(
    () => generateVoucherPrintPdf(buildVoucherFixture({ templateKey: "classic-v2" })),
    /template "classic-v2" is not registered/i,
  );
});

test("generuje PRINT PDF přes master s bleedem a TrimBoxem", async () => {
  const { generateVoucherPrintPdf, mm } = await import("./voucher-pdf-core");
  const pdfBytes = await generateVoucherPrintPdf(buildVoucherFixture());
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(0);

  assert.equal(pdf.getPageCount(), 1);
  assert.deepEqual(roundBox(page.getSize()), roundBox({ width: mm(216), height: mm(105) }));
  assert.deepEqual(roundBox(page.getBleedBox()), roundBox({ x: 0, y: 0, width: mm(216), height: mm(105) }));
  assert.deepEqual(roundBox(page.getTrimBox()), roundBox({ x: mm(3), y: mm(3), width: mm(210), height: mm(99) }));
  assert.equal(Buffer.from(pdfBytes).subarray(0, 4).toString("utf8"), "%PDF");
});

test("generuje DIGITAL PDF vektorovým ořezem PRINT varianty", async () => {
  const { generateVoucherDigitalPdf, mm } = await import("./voucher-pdf-core");
  const pdfBytes = await generateVoucherDigitalPdf(buildVoucherFixture());
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(0);

  assert.equal(pdf.getPageCount(), 1);
  assert.deepEqual(roundBox(page.getSize()), roundBox({ width: mm(210), height: mm(99) }));
  assert.deepEqual(roundBox(page.getTrimBox()), roundBox({ x: 0, y: 0, width: mm(210), height: mm(99) }));
  assert.deepEqual(roundBox(page.getCropBox()), roundBox({ x: 0, y: 0, width: mm(210), height: mm(99) }));
  assert.equal(Buffer.from(pdfBytes).subarray(0, 4).toString("utf8"), "%PDF");
});

test("renderer používá layout druhé template včetně QR a validity souřadnic", async () => {
  const { generateVoucherPrintPdf, mm } = await import("./voucher-pdf-core");
  const classic = requireVoucherTemplate("classic-v1");
  const mockTemplate = {
    ...classic,
    key: "test-template-v1",
    label: "Testovací",
    layout: {
      ...classic.layout,
      validityArea: { ...classic.layout.validityArea, xMm: 24, baselineMm: 20 },
      qrArea: { ...classic.layout.qrArea, xMm: 160, yMm: 12, widthMm: 20, heightMm: 20 },
    },
  };
  const registry = createVoucherTemplateRegistry([classic, mockTemplate]);
  const pdfBytes = await generateVoucherPrintPdf(
    buildVoucherFixture({ templateKey: "test-template-v1" }),
    { registry },
  );
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(0);
  const content = new TextDecoder().decode(getPageOverlayContent(page));

  assert.match(content, new RegExp(`1 0 0 1 ${pdfNumber(mm(160))}\\d* ${pdfNumber(mm(12))}\\d* cm`));
  assert.match(content, new RegExp(`1 0 0 1 [\\d.]+ ${pdfNumber(mm(20))}\\d* Tm`));
});

test("historickou inactive template lze renderovat, ale není aktivní pro nové vouchery", async () => {
  const { generateVoucherDigitalPdf } = await import("./voucher-pdf-core");
  const classic = requireVoucherTemplate("classic-v1");
  const inactiveTemplate = { ...classic, key: "test-template-inactive-v1", activeForNewVouchers: false };
  const registry = createVoucherTemplateRegistry([classic, inactiveTemplate]);

  assert.equal(registry.getActiveForNewVouchers().some((template) => template.key === inactiveTemplate.key), false);
  const pdfBytes = await generateVoucherDigitalPdf(
    buildVoucherFixture({ templateKey: inactiveTemplate.key }),
    { registry },
  );

  assert.equal((await PDFDocument.load(pdfBytes)).getPageCount(), 1);
});

function roundBox(box: { x?: number; y?: number; width: number; height: number }) {
  return {
    x: Math.round((box.x ?? 0) * 100) / 100,
    y: Math.round((box.y ?? 0) * 100) / 100,
    width: Math.round(box.width * 100) / 100,
    height: Math.round(box.height * 100) / 100,
  };
}

function getPageOverlayContent(page: ReturnType<PDFDocument["getPage"]>) {
  const contents = (page as unknown as {
    node: { Contents: () => { size: () => number; lookup: (index: number) => { getContents: () => Uint8Array } } };
  }).node.Contents();
  const streams = [] as Uint8Array[];

  for (let index = 0; index < contents.size(); index += 1) {
    const encoded = contents.lookup(index).getContents();

    try {
      streams.push(inflateSync(encoded));
    } catch {
      streams.push(encoded);
    }
  }

  return Buffer.concat(streams);
}

function pdfNumber(value: number) {
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

type VoucherFixture = Omit<
  ReturnType<typeof buildBaseVoucherFixture>,
  "originalValueCzk" | "remainingValueCzk"
> & {
  originalValueCzk: number | null;
  remainingValueCzk: number | null;
};

function buildVoucherFixture(overrides: Partial<VoucherFixture> = {}): VoucherFixture {
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
    templateKey: "classic-v1",
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
    validUntil: new Date("2027-09-16T00:00:00.000Z"),
    issuedAt: new Date("2026-01-01T00:00:00.000Z"),
    cancelledAt: null,
    cancelledByUserId: null,
    cancelReason: null,
    updatedByUserId: null,
    purchaserName: "Marie Kupující",
    purchaserEmail: "marie@example.com",
    recipientName: "Obdarovaná",
    message: "Soukromé věnování",
    internalNote: "Neveřejná poznámka",
    createdByUserId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    service: null,
    createdByUser: null,
    cancelledByUser: null,
    updatedByUser: null,
    redemptions: [],
    emailHistory: [],
  };
}
