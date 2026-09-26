import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { VoucherType } from "@/generated/prisma/browser";
import { PDFDocument, cmyk, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

import { formatVoucherValue } from "@/features/vouchers/lib/voucher-format";
import { type getVoucherDetail } from "@/features/vouchers/lib/voucher-read-models";
import { VoucherTemplateError } from "@/features/vouchers/lib/voucher-template-error";
import { siteConfig } from "@/config/site";
import { type ResolvedVoucherTemplate } from "@/features/vouchers/lib/voucher-template-repository";
import { requireVoucherTemplateById, resolveVoucherTemplate } from "@/features/vouchers/lib/voucher-template-repository";
import { VOUCHER_PRINT_GEOMETRY } from "@/features/vouchers/lib/voucher-template-layout";
import { fitVoucherTextToArea, VOUCHER_TEXT_HORIZONTAL_INSET_MM } from "@/features/vouchers/lib/voucher-text-fit";
import { getPersistedVoucherRenderMode } from "@/features/vouchers/lib/voucher-render-policy";

type VoucherPdfData = NonNullable<Awaited<ReturnType<typeof getVoucherDetail>>>;
type VoucherStockBatchPdfItem = Pick<VoucherPdfData, "code">;
type VoucherTemplateRenderDefinition = Pick<ResolvedVoucherTemplate, "key" | "label" | "layout">;
type VoucherRenderOptions = { failOnTextOverflow?: boolean; renderMode?: "STRICT" | "HISTORICAL" };

export const MM_TO_PT = 72 / 25.4;
const MASTER_PAGE_SIZE_TOLERANCE_MM = 0.35;
export const VOUCHER_PRINT_WIDTH_MM = VOUCHER_PRINT_GEOMETRY.widthMm;
export const VOUCHER_PRINT_HEIGHT_MM = VOUCHER_PRINT_GEOMETRY.heightMm;
export const VOUCHER_TRIM_X_MM = VOUCHER_PRINT_GEOMETRY.trimXmm;
export const VOUCHER_TRIM_Y_MM = VOUCHER_PRINT_GEOMETRY.trimYmm;
export const VOUCHER_TRIM_WIDTH_MM = VOUCHER_PRINT_GEOMETRY.trimWidthMm;
export const VOUCHER_TRIM_HEIGHT_MM = VOUCHER_PRINT_GEOMETRY.trimHeightMm;

export const VOUCHER_PRINT_WIDTH_PT = mm(VOUCHER_PRINT_WIDTH_MM);
export const VOUCHER_PRINT_HEIGHT_PT = mm(VOUCHER_PRINT_HEIGHT_MM);
export const VOUCHER_TRIM_X_PT = mm(VOUCHER_TRIM_X_MM);
export const VOUCHER_TRIM_Y_PT = mm(VOUCHER_TRIM_Y_MM);
export const VOUCHER_TRIM_WIDTH_PT = mm(VOUCHER_TRIM_WIDTH_MM);
export const VOUCHER_TRIM_HEIGHT_PT = mm(VOUCHER_TRIM_HEIGHT_MM);

const FONT_ROOT = path.join(process.cwd(), "node_modules/@fontsource/noto-sans/files");
const fontRegularLatinPath = path.join(FONT_ROOT, "noto-sans-latin-400-normal.woff");
const fontRegularLatinExtPath = path.join(FONT_ROOT, "noto-sans-latin-ext-400-normal.woff");
const fontBoldLatinPath = path.join(FONT_ROOT, "noto-sans-latin-700-normal.woff");
const fontBoldLatinExtPath = path.join(FONT_ROOT, "noto-sans-latin-ext-700-normal.woff");

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Europe/Prague",
});

type FontPair = {
  primary: PDFFont;
  fallback: PDFFont;
  primaryCharacters: Set<number>;
  fallbackCharacters: Set<number>;
};

type DynamicTextOptions = {
  fontPair: FontPair;
  size: number;
  color: NonNullable<Parameters<PDFPage["drawText"]>[1]>["color"];
};

export function mm(value: number) {
  return value * MM_TO_PT;
}

export function buildVoucherPdfFilename(code: string) {
  const safeCode = code.replace(/[^A-Za-z0-9-]/g, "");

  return `voucher-${safeCode || "PP"}.pdf`;
}

export function buildVoucherPrintPdfFilename(code: string) {
  const safeCode = code.replace(/[^A-Za-z0-9-]/g, "");

  return `voucher-${safeCode || "PP"}-tiskove.pdf`;
}

export function buildVoucherVerificationUrl(code: string, baseUrl = siteConfig.canonicalUrl) {
  const url = new URL("/vouchery/overeni", baseUrl);
  url.searchParams.set("code", code);

  return url.toString();
}

export function buildVoucherPdfOverlayData(
  voucher: Pick<
    VoucherPdfData,
    "templateKey" | "type" | "originalValueCzk" | "remainingValueCzk" | "serviceNameSnapshot" | "servicePriceSnapshotCzk" | "validUntil" | "code"
  >,
) {
  return {
    templateKey: voucher.templateKey,
    value: voucher.type === VoucherType.VALUE ? formatVoucherValue(voucher) : voucher.serviceNameSnapshot?.trim() || "Služba",
    validUntil: voucher.validUntil ? dateFormatter.format(voucher.validUntil) : "Bez omezení",
    code: voucher.code,
    verificationUrl: buildVoucherVerificationUrl(voucher.code),
  };
}

export async function generatePersistedVoucherPrintPdf(voucher: VoucherPdfData) {
  if (!voucher.templateId) throw new VoucherTemplateError(voucher.templateKey, { message: "Voucher nemá přiřazenou šablonu." });
  return generateResolvedVoucherPrintPdf(voucher, await resolveVoucherTemplate(await requireVoucherTemplateById(voucher.templateId)), { renderMode: getPersistedVoucherRenderMode(voucher) });
}

export async function generatePersistedVoucherDigitalPdf(voucher: VoucherPdfData) {
  if (!voucher.templateId) throw new VoucherTemplateError(voucher.templateKey, { message: "Voucher nemá přiřazenou šablonu." });
  return generateResolvedVoucherDigitalPdf(voucher, await resolveVoucherTemplate(await requireVoucherTemplateById(voucher.templateId)), { renderMode: getPersistedVoucherRenderMode(voucher) });
}

/** Pure runtime renderer: receives an already resolved DB template, never Prisma or filesystem paths. */
export async function generateResolvedVoucherPrintPdf(voucher: VoucherPdfData, template: ResolvedVoucherTemplate, options: VoucherRenderOptions = {}) {
  const masterBytes = template.masterBytes;
  const pdf = await PDFDocument.load(masterBytes);
  validateMasterPageSize(pdf, template);
  const page = pdf.getPage(0);

  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Dárkový poukaz ${voucher.code}`);
  pdf.setAuthor("PP Studio");
  pdf.setSubject(`Dárkový poukaz PP Studio · ${template.label}`);
  pdf.setCreator("PP Studio administrace");
  pdf.setProducer("PP Studio administrace");

  const [regularLatinBytes, regularLatinExtBytes, boldLatinBytes, boldLatinExtBytes] = await Promise.all([
    readFile(fontRegularLatinPath),
    readFile(fontRegularLatinExtPath),
    readFile(fontBoldLatinPath),
    readFile(fontBoldLatinExtPath),
  ]);

  const regularFont = createFontPair(
    await pdf.embedFont(regularLatinBytes, { subset: true }),
    await pdf.embedFont(regularLatinExtBytes, { subset: true }),
  );
  const boldFont = createFontPair(
    await pdf.embedFont(boldLatinBytes, { subset: true }),
    await pdf.embedFont(boldLatinExtBytes, { subset: true }),
  );
  const qrCode = QRCode.create(buildVoucherVerificationUrl(voucher.code), { errorCorrectionLevel: "M" });

  drawVoucherOverlay(page, voucher, template, regularFont, boldFont, qrCode, options);
  setPrintPageBoxes(page, template);

  return pdf.save();
}

export function buildVoucherStockPdfFilename(batchNumber: string) {
  const safeBatchNumber = batchNumber.replace(/[^A-Za-z0-9-]/g, "");

  return `voucher-stock-${safeBatchNumber || "serie"}.pdf`;
}

export async function generateResolvedVoucherBatchPrintPdf(
  batch: { batchNumber: string; items: readonly VoucherStockBatchPdfItem[] },
  template: ResolvedVoucherTemplate,
  options: VoucherRenderOptions = {},
) {
  const [regularLatinBytes, regularLatinExtBytes, boldLatinBytes, boldLatinExtBytes] = await Promise.all([
    readFile(fontRegularLatinPath), readFile(fontRegularLatinExtPath), readFile(fontBoldLatinPath), readFile(fontBoldLatinExtPath),
  ]);
  const masterPdf = await PDFDocument.load(template.masterBytes);
  validateMasterPageSize(masterPdf, template);
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const regularFont = createFontPair(await pdf.embedFont(regularLatinBytes, { subset: true }), await pdf.embedFont(regularLatinExtBytes, { subset: true }));
  const boldFont = createFontPair(await pdf.embedFont(boldLatinBytes, { subset: true }), await pdf.embedFont(boldLatinExtBytes, { subset: true }));
  for (const item of batch.items) {
    const [page] = await pdf.copyPages(masterPdf, [0]); pdf.addPage(page);
    drawVoucherCodeAndQrOverlay(page, item.code, template, regularFont, boldFont, QRCode.create(buildVoucherVerificationUrl(item.code), { errorCorrectionLevel: "M" }), options);
    setPrintPageBoxes(page, template);
  }
  pdf.setTitle(`Předtištěné vouchery ${batch.batchNumber}`); pdf.setAuthor("PP Studio"); pdf.setSubject(`Tisková série voucherů PP Studio · ${template.label}`); pdf.setCreator("PP Studio administrace"); pdf.setProducer("PP Studio administrace");
  return pdf.save();
}

function validateMasterPageSize(pdf: PDFDocument, template: VoucherTemplateRenderDefinition) {
  if (pdf.getPageCount() === 0) {
    throw new VoucherTemplateError(template.key, {
      code: "invalid_master_page_size",
      message: `Voucher template "${template.key}" has invalid page size. Expected ${formatPageSizeMm(template.layout.printPage.widthMm, template.layout.printPage.heightMm)}, got no pages.`,
    });
  }

  const actual = pdf.getPage(0).getSize();
  const expected = {
    width: mm(template.layout.printPage.widthMm),
    height: mm(template.layout.printPage.heightMm),
  };
  const tolerance = mm(MASTER_PAGE_SIZE_TOLERANCE_MM);

  if (Math.abs(actual.width - expected.width) > tolerance || Math.abs(actual.height - expected.height) > tolerance) {
    throw new VoucherTemplateError(template.key, {
      code: "invalid_master_page_size",
      message: `Voucher template "${template.key}" has invalid page size. Expected ${formatPageSizeMm(template.layout.printPage.widthMm, template.layout.printPage.heightMm)}, got ${formatPageSizeMm(actual.width / MM_TO_PT, actual.height / MM_TO_PT)}.`,
    });
  }
}

function formatPageSizeMm(widthMm: number, heightMm: number) {
  return `${formatMillimeters(widthMm)} × ${formatMillimeters(heightMm)} mm`;
}

function formatMillimeters(value: number) {
  return Number(value.toFixed(2)).toString();
}

export async function generateResolvedVoucherDigitalPdf(voucher: VoucherPdfData, template: ResolvedVoucherTemplate, options: VoucherRenderOptions = {}) {
  const trim = template.layout.trim;
  const printWidthPt = mm(template.layout.printPage.widthMm);
  const printHeightPt = mm(template.layout.printPage.heightMm);
  const trimXPt = mm(trim.xMm);
  const trimYPt = mm(trim.yMm);
  const trimWidthPt = mm(trim.widthMm);
  const trimHeightPt = mm(trim.heightMm);
  const printBytes = await generateResolvedVoucherPrintPdf(voucher, template, options);
  const pdf = await PDFDocument.create();
  const [printPage] = await pdf.embedPdf(printBytes, [0]);
  const page = pdf.addPage([trimWidthPt, trimHeightPt]);
  page.drawPage(printPage, { x: -trimXPt, y: -trimYPt, width: printWidthPt, height: printHeightPt });
  page.setTrimBox(0, 0, trimWidthPt, trimHeightPt);
  page.setCropBox(0, 0, trimWidthPt, trimHeightPt);
  pdf.setTitle(`Dárkový poukaz ${voucher.code}`);
  pdf.setAuthor("PP Studio");
  pdf.setSubject("Digitální dárkový poukaz PP Studio");
  pdf.setCreator("PP Studio administrace");
  pdf.setProducer("PP Studio administrace");
  return pdf.save();
}

function drawVoucherOverlay(
  page: PDFPage,
  voucher: VoucherPdfData,
  template: VoucherTemplateRenderDefinition,
  regularFont: FontPair,
  boldFont: FontPair,
  qrCode: ReturnType<typeof QRCode.create>,
  options: VoucherRenderOptions,
) {
  const layout = template.layout;
  const overlay = buildVoucherPdfOverlayData(voucher);
  const value = overlay.value;
  const valueAreaKey = voucher.type === VoucherType.VALUE ? "valueArea" : "serviceArea";
  const valueArea = layout[valueAreaKey];
  const valueTypography = valueArea.typography;
  const valueFont = valueTypography.fontWeight === "bold" ? boldFont : regularFont;
  const valueInsetMm = VOUCHER_TEXT_HORIZONTAL_INSET_MM[valueAreaKey];
  const valueFit = fitTextForArea(value, valueFont, valueArea, valueInsetMm, voucher.type === VoucherType.VALUE && options.renderMode === "HISTORICAL");
  if (valueFit.overflowed && voucher.type === VoucherType.VALUE && options.renderMode === "HISTORICAL") {
    throw new VoucherTemplateError(template.key, { code: "text_overflow", message: "Historickou částku se nepodařilo vykreslit bez zkrácení." });
  }
  assertTextFitsTemplate(valueFit, template, valueAreaKey, options);

  const valueLineHeight = mm(valueFit.lineHeightMm);
  const valueBottomY = mm(valueArea.baselineMm);
  const valueStartY = valueBottomY + (valueFit.lines.length - 1) * valueLineHeight;

  valueFit.lines.forEach((line, index) => {
    drawTextLine(page, line, getTextX(line, valueArea, valueFont, valueFit.fontSizePt, valueInsetMm), valueStartY - index * valueLineHeight, {
      fontPair: valueFont,
      size: valueFit.fontSizePt,
      color: voucherTextColor(valueTypography.color),
    });
  });

  const dateValue = overlay.validUntil;
  const validityArea = layout.validityArea;
  const validityFont = validityArea.typography.fontWeight === "bold" ? boldFont : regularFont;
  const validityInsetMm = VOUCHER_TEXT_HORIZONTAL_INSET_MM.validityArea;
  const validityFit = fitTextForArea(dateValue, validityFont, { ...validityArea, maxLines: 1 }, validityInsetMm);
  assertTextFitsTemplate(validityFit, template, "validityArea", options);
  drawFittedTextLines(page, validityFit, validityArea, validityFont, validityInsetMm);

  drawVoucherCodeAndQrOverlay(page, voucher.code, template, regularFont, boldFont, qrCode, options);
}

function drawVoucherCodeAndQrOverlay(
  page: PDFPage,
  code: string,
  template: VoucherTemplateRenderDefinition,
  regularFont: FontPair,
  boldFont: FontPair,
  qrCode: ReturnType<typeof QRCode.create>,
  options: VoucherRenderOptions,
) {
  const codeArea = template.layout.codeArea;
  const codeFont = codeArea.typography.fontWeight === "bold" ? boldFont : regularFont;
  const codeInsetMm = VOUCHER_TEXT_HORIZONTAL_INSET_MM.codeArea;
  const codeFit = fitTextForArea(code, codeFont, { ...codeArea, maxLines: 1 }, codeInsetMm);
  assertTextFitsTemplate(codeFit, template, "codeArea", options);
  drawFittedTextLines(page, codeFit, codeArea, codeFont, codeInsetMm);

  drawVoucherQr(page, qrCode, template);
}

function fitTextForArea(
  text: string,
  fontPair: FontPair,
  area: VoucherTemplateRenderDefinition["layout"]["valueArea"],
  horizontalInsetMm: number,
  historicalValueFallback = false,
) {
  return fitVoucherTextToArea(
    text,
    area,
    (value, size) => measureText(value, fontPair, size) / MM_TO_PT,
    horizontalInsetMm,
    historicalValueFallback ? { minimumFontSizePt: 0.1, ellipsisOnOverflow: false } : undefined,
  );
}

function drawFittedTextLines(
  page: PDFPage,
  fit: ReturnType<typeof fitTextForArea>,
  area: VoucherTemplateRenderDefinition["layout"]["valueArea"],
  fontPair: FontPair,
  horizontalInsetMm: number,
) {
  const lineHeight = mm(fit.lineHeightMm);
  const startY = mm(area.baselineMm) + (fit.lines.length - 1) * lineHeight;

  fit.lines.forEach((line, index) => {
    drawTextLine(
      page,
      line,
      getTextX(line, area, fontPair, fit.fontSizePt, horizontalInsetMm),
      startY - index * lineHeight,
      {
        fontPair,
        size: fit.fontSizePt,
        color: voucherTextColor(area.typography.color),
      },
    );
  });
}

function assertTextFitsTemplate(
  fit: ReturnType<typeof fitTextForArea>,
  template: VoucherTemplateRenderDefinition,
  areaKey: "valueArea" | "serviceArea" | "validityArea" | "codeArea",
  options: VoucherRenderOptions,
) {
  // Peněžní hodnota nesmí být na vydaném voucheru nikdy zkrácená. Ostatní
  // historické textové oblasti dál respektují dosavadní fitting mimo preflight.
  if ((!options.failOnTextOverflow && areaKey !== "valueArea") || !fit.overflowed) return;

  const labels = { valueArea: "Hodnota", serviceArea: "Služba", validityArea: "Platnost", codeArea: "Kód" } as const;
  throw new VoucherTemplateError(template.key, {
    code: "text_overflow",
    message: `Dynamický text se nevejde do oblasti „${labels[areaKey]}“ ani při minimální velikosti písma.`,
  });
}

function voucherTextColor(color: { c: number; m: number; y: number; k: number }) {
  return cmyk(color.c, color.m, color.y, color.k);
}

function drawVoucherQr(page: PDFPage, qrCode: ReturnType<typeof QRCode.create>, template: VoucherTemplateRenderDefinition) {
  const area = template.layout.qrArea;
  const x = mm(area.xMm);
  const y = mm(area.yMm);
  const width = mm(area.widthMm);
  const height = mm(area.heightMm);
  const quietZoneModules = 4;
  const totalModules = qrCode.modules.size + quietZoneModules * 2;
  const moduleSize = Math.min(width, height) / totalModules;
  const qrWidth = moduleSize * totalModules;
  const qrX = x + (width - qrWidth) / 2;
  const qrY = y + (height - qrWidth) / 2;

  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: cmyk(0, 0, 0, 0),
  });

  for (let row = 0; row < qrCode.modules.size; row += 1) {
    for (let column = 0; column < qrCode.modules.size; column += 1) {
      if (!qrCode.modules.get(row, column)) {
        continue;
      }

      page.drawRectangle({
        x: qrX + (column + quietZoneModules) * moduleSize,
        y: qrY + (qrCode.modules.size - row - 1 + quietZoneModules) * moduleSize,
        width: moduleSize,
        height: moduleSize,
        color: cmyk(0, 0, 0, 1),
      });
    }
  }
}

function getTextX(
  text: string,
  area: { xMm: number; widthMm: number; typography: { alignment: "left" | "center" } },
  fontPair: FontPair,
  size: number,
  widthInsetMm = 0,
) {
  const x = mm(area.xMm + widthInsetMm);
  const width = mm(area.widthMm - widthInsetMm * 2);

  return area.typography.alignment === "left"
    ? x
    : x + (width - measureText(text, fontPair, size)) / 2;
}

function setPrintPageBoxes(page: PDFPage, template: VoucherTemplateRenderDefinition) {
  const layout = template.layout;

  page.setCropBox(0, 0, mm(layout.printPage.widthMm), mm(layout.printPage.heightMm));
  page.setBleedBox(0, 0, mm(layout.printPage.widthMm), mm(layout.printPage.heightMm));
  page.setTrimBox(mm(layout.trim.xMm), mm(layout.trim.yMm), mm(layout.trim.widthMm), mm(layout.trim.heightMm));
}

function createFontPair(primary: PDFFont, fallback: PDFFont): FontPair {
  return {
    primary,
    fallback,
    primaryCharacters: new Set(primary.getCharacterSet()),
    fallbackCharacters: new Set(fallback.getCharacterSet()),
  };
}

function pickFont(character: string, fontPair: FontPair) {
  const codePoint = character.codePointAt(0) ?? 0;

  if (fontPair.primaryCharacters.has(codePoint) || !fontPair.fallbackCharacters.has(codePoint)) {
    return fontPair.primary;
  }

  return fontPair.fallback;
}

function measureText(text: string, fontPair: FontPair, size: number) {
  let width = 0;

  for (const character of text) {
    width += pickFont(character, fontPair).widthOfTextAtSize(character, size);
  }

  return width;
}

function drawTextLine(page: PDFPage, text: string, x: number, y: number, options: DynamicTextOptions) {
  let cursorX = x;
  let run = "";
  let runFont: PDFFont | null = null;

  for (const character of text) {
    const characterFont = pickFont(character, options.fontPair);

    if (runFont && characterFont !== runFont) {
      page.drawText(run, { font: runFont, x: cursorX, y, size: options.size, color: options.color });
      cursorX += runFont.widthOfTextAtSize(run, options.size);
      run = character;
    } else {
      run += character;
    }

    runFont = characterFont;
  }

  if (run && runFont) {
    page.drawText(run, { font: runFont, x: cursorX, y, size: options.size, color: options.color });
  }
}
