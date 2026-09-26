import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import test from "node:test";

import { VoucherStatus, VoucherType } from "@/generated/prisma/browser";
import { PDFDocument } from "pdf-lib";

import {
  createVoucherTemplateRegistry,
  requireVoucherTemplate,
  VoucherTemplateError,
} from "@/features/vouchers/lib/voucher-template-test-registry";

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
  await access("src/features/vouchers/bootstrap-assets/classic-v1.pdf");
});

test("overlay data obsahují českou VALUE částku a verification URL", async () => {
  const { buildVoucherPdfOverlayData } = await import("./voucher-pdf-test-renderers");
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
  const { buildVoucherPdfOverlayData } = await import("./voucher-pdf-test-renderers");
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

test("dlouhý název služby se vejde do dvou řádků a při overflowu dostane ellipsis", async () => {
  const { fitVoucherText } = await import("./voucher-pdf-test-renderers");
  const measure = (value: string, size: number) => Array.from(value).length * size;
  const wrap = (value: string, size: number, maxWidth: number) => {
    const maxCharacters = Math.max(1, Math.floor(maxWidth / size));
    const characters = Array.from(value);
    const lines: string[] = [];

    for (let index = 0; index < characters.length; index += maxCharacters) {
      lines.push(characters.slice(index, index + maxCharacters).join(""));
    }

    return lines;
  };

  const normal = fitVoucherText("Lash lifting", measure, wrap, 180, 14.5, 8.5, 2);
  const long = fitVoucherText("Velmi dlouhá služba s českou diakritikou pro výrazné prodloužení řas a relaxační péči", measure, wrap, 180, 14.5, 8.5, 2);
  const extreme = fitVoucherText("SuperdlouhéSlovoBezMezerKteréSeMusíBezpečněZkrátit", measure, wrap, 180, 14.5, 8.5, 2);

  assert.equal(normal.overflowed, false);
  assert.equal(long.overflowed, true);
  assert.equal(extreme.overflowed, true);
  assert.ok(long.size >= 8.5);
  assert.ok(extreme.size >= 8.5);
  assert.ok(long.lines.length <= 2);
  assert.ok(extreme.lines.length <= 2);
  assert.match(long.lines.at(-1) ?? "", /…$/);
  assert.match(extreme.lines.at(-1) ?? "", /…$/);
});

test("PRINT renderer zvládne běžné, dlouhé, extrémní i diakritické SERVICE názvy", async () => {
  const { generateVoucherPrintPdf } = await import("./voucher-pdf-test-renderers");
  const names = [
    "Lash lifting",
    "Velmi dlouhá služba pro výrazné prodloužení řas",
    "SuperdlouhéSlovoBezMezerKteréSeMusíBezpečněZkrátit",
    "Korejský lifting řas a úprava obočí",
  ];

  for (const serviceNameSnapshot of names) {
    const bytes = await generateVoucherPrintPdf(buildVoucherFixture({
      type: VoucherType.SERVICE,
      originalValueCzk: null,
      remainingValueCzk: null,
      serviceNameSnapshot,
      servicePriceSnapshotCzk: 1590,
    }));

    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1);
  }
});

test("strict render odmítne layout, který by dynamický text musel oříznout", async () => {
  const { generateVoucherPrintPdf } = await import("./voucher-pdf-test-renderers");
  const classic = requireVoucherTemplate("classic-v1");
  const overflowTemplate = {
    ...classic,
    key: "overflow-v1",
    layout: {
      ...classic.layout,
      serviceArea: {
        ...classic.layout.serviceArea,
        widthMm: 24,
        heightMm: 2,
        maxLines: 1,
      },
    },
  };
  const registry = createVoucherTemplateRegistry([classic, overflowTemplate]);

  await assert.rejects(
    () => generateVoucherPrintPdf(
      buildVoucherFixture({
        templateKey: overflowTemplate.key,
        type: VoucherType.SERVICE,
        originalValueCzk: null,
        remainingValueCzk: null,
        serviceNameSnapshot: "Velmi dlouhý název služby pro kontrolu preflightu",
        servicePriceSnapshotCzk: 1500,
      }),
      { registry, failOnTextOverflow: true },
    ),
    (error: unknown) => error instanceof VoucherTemplateError && error.code === "text_overflow",
  );
});

test("overlay ignoruje osobní a interní voucherová pole", async () => {
  const { buildVoucherPdfOverlayData } = await import("./voucher-pdf-test-renderers");
  const data = buildVoucherPdfOverlayData(buildVoucherFixture());

  assert.doesNotMatch(JSON.stringify(data), /Marie Kupující|Obdarovaná|Soukromé věnování|Neveřejná poznámka/);
});

test("neznámý templateKey se při renderu odmítne bez fallbacku", async () => {
  const { generateVoucherPrintPdf } = await import("./voucher-pdf-test-renderers");

  await assert.rejects(
    () => generateVoucherPrintPdf(buildVoucherFixture({ templateKey: "classic-v2" })),
    /template "classic-v2" is not registered/i,
  );
});

test("generuje PRINT PDF přes master s bleedem a TrimBoxem", async () => {
  const { generateVoucherPrintPdf, mm } = await import("./voucher-pdf-test-renderers");
  const pdfBytes = await generateVoucherPrintPdf(buildVoucherFixture());
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(0);

  assert.equal(pdf.getPageCount(), 1);
  assert.deepEqual(roundBox(page.getSize()), roundBox({ width: mm(216), height: mm(105) }));
  assert.deepEqual(roundBox(page.getBleedBox()), roundBox({ x: 0, y: 0, width: mm(216), height: mm(105) }));
  assert.deepEqual(roundBox(page.getTrimBox()), roundBox({ x: mm(3), y: mm(3), width: mm(210), height: mm(99) }));
  const content = getPageOverlayContent(page).toString("latin1");
  assert.match(content, /\bk\s/);
  assert.doesNotMatch(content, /\brg\s/);
  assert.equal(Buffer.from(pdfBytes).subarray(0, 4).toString("utf8"), "%PDF");
});

test("odmítne master s rozměrem odlišným od layoutu šablony", async () => {
  const { generateVoucherPrintPdf } = await import("./voucher-pdf-test-renderers");
  const classic = requireVoucherTemplate("classic-v1");
  const invalidSizeTemplate = {
    ...classic,
    key: "invalid-size-v1",
    layout: {
      ...classic.layout,
      printPage: { widthMm: 215, heightMm: 105 },
    },
  };
  const registry = createVoucherTemplateRegistry([invalidSizeTemplate]);

  await assert.rejects(
    () => generateVoucherPrintPdf(buildVoucherFixture({ templateKey: invalidSizeTemplate.key }), { registry }),
    (error: unknown) => {
      assert.ok(error instanceof VoucherTemplateError);
      assert.equal(error.code, "invalid_master_page_size");
      assert.match(error.message, /invalid-size-v1/);
      assert.match(error.message, /Expected 215 × 105 mm, got 216 × 105 mm/);
      return true;
    },
  );
});

test("generuje DIGITAL PDF vektorovým ořezem PRINT varianty", async () => {
  const { generateVoucherDigitalPdf, mm } = await import("./voucher-pdf-test-renderers");
  const pdfBytes = await generateVoucherDigitalPdf(buildVoucherFixture());
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(0);

  assert.equal(pdf.getPageCount(), 1);
  assert.deepEqual(roundBox(page.getSize()), roundBox({ width: mm(210), height: mm(99) }));
  assert.deepEqual(roundBox(page.getTrimBox()), roundBox({ x: 0, y: 0, width: mm(210), height: mm(99) }));
  assert.deepEqual(roundBox(page.getCropBox()), roundBox({ x: 0, y: 0, width: mm(210), height: mm(99) }));
  assert.equal(Buffer.from(pdfBytes).subarray(0, 4).toString("utf8"), "%PDF");
});

test("historický voucher po backfillu má PRINT, DIGITAL i e-mailovou přílohu", async () => {
  const { generateVoucherPrintPdf, generateVoucherDigitalPdf } = await import("./voucher-pdf-test-renderers");
  const { buildVoucherEmailTemplate } = await import("./voucher-email-template");
  const voucher = buildVoucherFixture({ templateId: "classic-template" });
  const printPdf = await generateVoucherPrintPdf(voucher);
  const digitalPdf = await generateVoucherDigitalPdf(voucher);
  const email = await buildVoucherEmailTemplate({
    subject: "Dárkový poukaz PP Studio",
    voucher,
    salon: { name: "PP Studio", addressLine: "Sadová 2, Zlín", phone: "+420 732 856 036", email: "info@ppstudio.cz" },
    verificationUrl: "https://ppstudio.cz/vouchery/overeni?code=PP-2026-A7K9X2",
    pdfFilename: "voucher-PP-2026-A7K9X2.pdf",
    pdfBytes: digitalPdf,
  });

  assert.equal((await PDFDocument.load(printPdf)).getPageCount(), 1);
  assert.equal((await PDFDocument.load(digitalPdf)).getPageCount(), 1);
  assert.equal(email.attachments[0]?.contentType, "application/pdf");
  assert.equal(Buffer.from(email.attachments[0]?.content ?? []).subarray(0, 4).toString("utf8"), "%PDF");
});

test("renderer používá layout druhé template včetně QR a validity souřadnic", async () => {
  const { generateVoucherPrintPdf, mm } = await import("./voucher-pdf-test-renderers");
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
  const { generateVoucherDigitalPdf } = await import("./voucher-pdf-test-renderers");
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

test("předtištěná stránka vykreslí pouze kód a QR a batch PDF má jednu stránku na kus", async () => {
  const { generateVoucherBatchPrintPdf, generateVoucherStockPrintPage, mm } = await import("./voucher-pdf-test-renderers");
  const items = [
    { code: "PP-2026-STOCK1" },
    { code: "PP-2026-STOCK2" },
    { code: "PP-2026-STOCK3" },
  ];
  const pageBytes = await generateVoucherStockPrintPage({ templateKey: "classic-v1", code: items[0].code });
  const pagePdf = await PDFDocument.load(pageBytes);
  const batchBytes = await generateVoucherBatchPrintPdf({ batchNumber: "2026-001", templateKey: "classic-v1", items });
  const batchPdf = await PDFDocument.load(batchBytes);

  assert.equal(pagePdf.getPageCount(), 1);
  assert.deepEqual(roundBox(pagePdf.getPage(0).getSize()), roundBox({ width: mm(216), height: mm(105) }));
  assert.equal(batchPdf.getPageCount(), 3);
  assert.deepEqual(roundBox(batchPdf.getPage(1).getTrimBox()), roundBox({ x: mm(3), y: mm(3), width: mm(210), height: mm(99) }));
  assert.notDeepEqual(getPageOverlayContent(batchPdf.getPage(0)), getPageOverlayContent(batchPdf.getPage(1)));
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
    templateId: null as string | null,
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
