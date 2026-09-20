import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { VoucherType } from "@/generated/prisma/browser";
import { PDFDocument, cmyk, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

import { formatVoucherValue } from "@/features/vouchers/lib/voucher-format";
import { type getVoucherDetail } from "@/features/vouchers/lib/voucher-read-models";
import {
  requireVoucherTemplate,
  voucherTemplateRegistry,
  VoucherTemplateError,
  type VoucherTemplateRegistry,
  type VoucherTemplateDefinition,
} from "@/features/vouchers/lib/voucher-template-registry";
import { siteConfig } from "@/config/site";
import { getVoucherMasterAssetReader } from "@/features/vouchers/lib/voucher-master-assets";

type VoucherPdfData = NonNullable<Awaited<ReturnType<typeof getVoucherDetail>>>;
type VoucherStockPdfData = Pick<VoucherPdfData, "templateKey" | "code">;
type VoucherStockBatchPdfItem = Pick<VoucherPdfData, "code">;

export const MM_TO_PT = 72 / 25.4;
const MASTER_PAGE_SIZE_TOLERANCE_MM = 0.35;
const classicV1Layout = voucherTemplateRegistry.require("classic-v1").layout;
export const VOUCHER_PRINT_WIDTH_MM = classicV1Layout.printPage.widthMm;
export const VOUCHER_PRINT_HEIGHT_MM = classicV1Layout.printPage.heightMm;
export const VOUCHER_TRIM_X_MM = classicV1Layout.trim.xMm;
export const VOUCHER_TRIM_Y_MM = classicV1Layout.trim.yMm;
export const VOUCHER_TRIM_WIDTH_MM = classicV1Layout.trim.widthMm;
export const VOUCHER_TRIM_HEIGHT_MM = classicV1Layout.trim.heightMm;

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

type VoucherPdfOptions = {
  registry?: VoucherTemplateRegistry;
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

export async function generateVoucherPdf(voucher: VoucherPdfData, options?: VoucherPdfOptions) {
  return generateVoucherDigitalPdf(voucher, options);
}

export async function generateVoucherPrintPdf(voucher: VoucherPdfData, options: VoucherPdfOptions = {}) {
  const registry = options.registry ?? voucherTemplateRegistry;
  const template = requireVoucherTemplate(voucher.templateKey, registry);
  const masterAssetReader = getVoucherMasterAssetReader(template.masterAssetKey);

  if (!masterAssetReader) {
    throw new VoucherTemplateError(template.key, {
      message: `Voucher template "${template.key}" has no registered master asset.`,
    });
  }

  const masterBytes = await masterAssetReader();
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

  drawVoucherOverlay(page, voucher, template, regularFont, boldFont, qrCode);
  setPrintPageBoxes(page, template);

  return pdf.save();
}

export function buildVoucherStockPdfFilename(batchNumber: string) {
  const safeBatchNumber = batchNumber.replace(/[^A-Za-z0-9-]/g, "");

  return `voucher-stock-${safeBatchNumber || "serie"}.pdf`;
}

export async function generateVoucherStockPrintPage(
  stockItem: VoucherStockPdfData,
  options: VoucherPdfOptions = {},
) {
  const registry = options.registry ?? voucherTemplateRegistry;
  const template = requireVoucherTemplate(stockItem.templateKey, registry);
  const masterAssetReader = getVoucherMasterAssetReader(template.masterAssetKey);

  if (!masterAssetReader) {
    throw new VoucherTemplateError(template.key, {
      message: `Voucher template "${template.key}" has no registered master asset.`,
    });
  }

  const masterBytes = await masterAssetReader();
  const pdf = await PDFDocument.load(masterBytes);
  validateMasterPageSize(pdf, template);
  const page = pdf.getPage(0);

  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Předtištěný voucher ${stockItem.code}`);
  pdf.setAuthor("PP Studio");
  pdf.setSubject(`Předtištěný voucher PP Studio · ${template.label}`);
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
  const qrCode = QRCode.create(buildVoucherVerificationUrl(stockItem.code), { errorCorrectionLevel: "M" });

  drawVoucherCodeAndQrOverlay(page, stockItem.code, template, regularFont, boldFont, qrCode);
  setPrintPageBoxes(page, template);

  return pdf.save();
}

export async function generateVoucherBatchPrintPdf(
  batch: { batchNumber: string; templateKey: string; items: readonly VoucherStockBatchPdfItem[] },
  options: VoucherPdfOptions = {},
) {
  const registry = options.registry ?? voucherTemplateRegistry;
  const template = requireVoucherTemplate(batch.templateKey, registry);
  const masterAssetReader = getVoucherMasterAssetReader(template.masterAssetKey);

  if (!masterAssetReader) {
    throw new VoucherTemplateError(template.key, {
      message: `Voucher template "${template.key}" has no registered master asset.`,
    });
  }

  const [masterBytes, regularLatinBytes, regularLatinExtBytes, boldLatinBytes, boldLatinExtBytes] = await Promise.all([
    masterAssetReader(),
    readFile(fontRegularLatinPath),
    readFile(fontRegularLatinExtPath),
    readFile(fontBoldLatinPath),
    readFile(fontBoldLatinExtPath),
  ]);
  const masterPdf = await PDFDocument.load(masterBytes);
  validateMasterPageSize(masterPdf, template);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regularFont = createFontPair(
    await pdf.embedFont(regularLatinBytes, { subset: true }),
    await pdf.embedFont(regularLatinExtBytes, { subset: true }),
  );
  const boldFont = createFontPair(
    await pdf.embedFont(boldLatinBytes, { subset: true }),
    await pdf.embedFont(boldLatinExtBytes, { subset: true }),
  );

  for (const item of batch.items) {
    const [page] = await pdf.copyPages(masterPdf, [0]);
    pdf.addPage(page);
    const qrCode = QRCode.create(buildVoucherVerificationUrl(item.code), { errorCorrectionLevel: "M" });
    drawVoucherCodeAndQrOverlay(page, item.code, template, regularFont, boldFont, qrCode);
    setPrintPageBoxes(page, template);
  }

  pdf.setTitle(`Předtištěné vouchery ${batch.batchNumber}`);
  pdf.setAuthor("PP Studio");
  pdf.setSubject(`Tisková série voucherů PP Studio · ${template.label}`);
  pdf.setCreator("PP Studio administrace");
  pdf.setProducer("PP Studio administrace");

  return pdf.save();
}

function validateMasterPageSize(pdf: PDFDocument, template: VoucherTemplateDefinition) {
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

export async function generateVoucherDigitalPdf(voucher: VoucherPdfData, options: VoucherPdfOptions = {}) {
  const registry = options.registry ?? voucherTemplateRegistry;
  const template = requireVoucherTemplate(voucher.templateKey, registry);
  const printWidthPt = mm(template.layout.printPage.widthMm);
  const printHeightPt = mm(template.layout.printPage.heightMm);
  const trim = template.layout.trim;
  const trimXPt = mm(trim.xMm);
  const trimYPt = mm(trim.yMm);
  const trimWidthPt = mm(trim.widthMm);
  const trimHeightPt = mm(trim.heightMm);
  const printBytes = await generateVoucherPrintPdf(voucher, options);
  const pdf = await PDFDocument.create();
  const [printPage] = await pdf.embedPdf(printBytes, [0]);
  const page = pdf.addPage([trimWidthPt, trimHeightPt]);

  page.drawPage(printPage, {
    x: -trimXPt,
    y: -trimYPt,
    width: printWidthPt,
    height: printHeightPt,
  });
  page.setTrimBox(0, 0, trimWidthPt, trimHeightPt);
  page.setCropBox(0, 0, trimWidthPt, trimHeightPt);
  pdf.setTitle(`Dárkový poukaz ${voucher.code}`);
  pdf.setAuthor("PP Studio");
  pdf.setSubject("Digitální dárkový poukaz PP Studio");
  pdf.setCreator("PP Studio administrace");
  pdf.setProducer("PP Studio administrace");

  return pdf.save();
}

export function getVoucherPrintPageBoxes(
  templateKey = "classic-v1",
  registry: VoucherTemplateRegistry = voucherTemplateRegistry,
) {
  const layout = requireVoucherTemplate(templateKey, registry).layout;

  return {
    media: { x: 0, y: 0, width: mm(layout.printPage.widthMm), height: mm(layout.printPage.heightMm) },
    bleed: { x: 0, y: 0, width: mm(layout.printPage.widthMm), height: mm(layout.printPage.heightMm) },
    trim: {
      x: mm(layout.trim.xMm),
      y: mm(layout.trim.yMm),
      width: mm(layout.trim.widthMm),
      height: mm(layout.trim.heightMm),
    },
  };
}

function drawVoucherOverlay(
  page: PDFPage,
  voucher: VoucherPdfData,
  template: VoucherTemplateDefinition,
  regularFont: FontPair,
  boldFont: FontPair,
  qrCode: ReturnType<typeof QRCode.create>,
) {
  const layout = template.layout;
  const overlay = buildVoucherPdfOverlayData(voucher);
  const value = overlay.value;
  const valueArea = voucher.type === VoucherType.VALUE ? layout.valueArea : layout.serviceArea;
  const valueTypography = valueArea.typography;
  const valueFont = valueTypography.fontWeight === "bold" ? boldFont : regularFont;
  const textColor = cmyk(0, 0.2, 0.2, 0.9);
  const valueFit = fitText(
    value,
    valueFont,
    mm(valueArea.widthMm),
    valueTypography.preferredFontSizePt,
    valueTypography.minFontSizePt,
    valueArea.maxLines,
  );
  const valueLineHeight = mm(valueTypography.lineHeightMm);
  const valueBottomY = mm(valueArea.baselineMm);
  const valueStartY = valueBottomY + (valueFit.lines.length - 1) * valueLineHeight;

  valueFit.lines.forEach((line, index) => {
    drawTextLine(page, line, getTextX(line, valueArea, valueFont, valueFit.size), valueStartY - index * valueLineHeight, {
      fontPair: valueFont,
      size: valueFit.size,
      color: textColor,
    });
  });

  const dateValue = overlay.validUntil;
  const validityArea = layout.validityArea;
  const validityFont = validityArea.typography.fontWeight === "bold" ? boldFont : regularFont;
  const validitySize = fitSingleLine(
    dateValue,
    validityFont,
    mm(validityArea.widthMm),
    validityArea.typography.preferredFontSizePt,
    validityArea.typography.minFontSizePt,
  );
  drawTextLine(
    page,
    dateValue,
    getTextX(dateValue, validityArea, validityFont, validitySize),
    mm(validityArea.baselineMm),
    { fontPair: validityFont, size: validitySize, color: textColor },
  );

  drawVoucherCodeAndQrOverlay(page, voucher.code, template, regularFont, boldFont, qrCode);
}

function drawVoucherCodeAndQrOverlay(
  page: PDFPage,
  code: string,
  template: VoucherTemplateDefinition,
  regularFont: FontPair,
  boldFont: FontPair,
  qrCode: ReturnType<typeof QRCode.create>,
) {
  const codeArea = template.layout.codeArea;
  const codeFont = codeArea.typography.fontWeight === "bold" ? boldFont : regularFont;
  const codeSize = fitSingleLine(
    code,
    codeFont,
    mm(codeArea.widthMm - 4),
    codeArea.typography.preferredFontSizePt,
    codeArea.typography.minFontSizePt,
  );
  drawTextLine(
    page,
    code,
    getTextX(code, codeArea, codeFont, codeSize, 2),
    mm(codeArea.baselineMm),
    { fontPair: codeFont, size: codeSize, color: cmyk(0, 0.2, 0.2, 0.9) },
  );

  drawVoucherQr(page, qrCode, template);
}

function drawVoucherQr(page: PDFPage, qrCode: ReturnType<typeof QRCode.create>, template: VoucherTemplateDefinition) {
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

function setPrintPageBoxes(page: PDFPage, template: VoucherTemplateDefinition) {
  const layout = template.layout;

  page.setCropBox(0, 0, mm(layout.printPage.widthMm), mm(layout.printPage.heightMm));
  page.setBleedBox(0, 0, mm(layout.printPage.widthMm), mm(layout.printPage.heightMm));
  page.setTrimBox(mm(layout.trim.xMm), mm(layout.trim.yMm), mm(layout.trim.widthMm), mm(layout.trim.heightMm));
}

function fitText(text: string, fontPair: FontPair, maxWidth: number, preferredSize: number, minimumSize: number, maxLines: number) {
  return fitVoucherText(
    text,
    (value, size) => measureText(value, fontPair, size),
    (value, size, width) => wrapText(value, fontPair, size, width),
    maxWidth,
    preferredSize,
    minimumSize,
    maxLines,
  );
}

export function fitVoucherText(
  text: string,
  measure: (value: string, size: number) => number,
  wrap: (value: string, size: number, maxWidth: number) => string[],
  maxWidth: number,
  preferredSize: number,
  minimumSize: number,
  maxLines: number,
) {
  for (let size = preferredSize; size >= minimumSize; size -= 0.25) {
    const lines = wrap(text, size, maxWidth);

    if (lines.length <= maxLines && lines.every((line) => measure(line, size) <= maxWidth)) {
      return { size, lines, overflowed: false };
    }
  }

  const size = minimumSize;
  const lines = wrap(text, size, maxWidth).slice(0, maxLines);
  const lastLineIndex = lines.length - 1;

  if (lastLineIndex >= 0) {
    lines[lastLineIndex] = addEllipsis(lines[lastLineIndex], measure, size, maxWidth);
  }

  return { size, lines, overflowed: true };
}

function addEllipsis(text: string, measure: (value: string, size: number) => number, size: number, maxWidth: number) {
  const ellipsis = "…";
  const characters = Array.from(text.trimEnd());

  for (let length = characters.length; length >= 0; length -= 1) {
    const candidate = `${characters.slice(0, length).join("").trimEnd()}${ellipsis}`;
    if (measure(candidate, size) <= maxWidth) {
      return candidate;
    }
  }

  return ellipsis;
}

function fitSingleLine(text: string, fontPair: FontPair, maxWidth: number, preferredSize: number, minimumSize: number) {
  for (let size = preferredSize; size >= minimumSize; size -= 0.25) {
    if (measureText(text, fontPair, size) <= maxWidth) {
      return size;
    }
  }

  return minimumSize;
}

function wrapText(text: string, fontPair: FontPair, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (!currentLine && measureText(word, fontPair, size) > maxWidth) {
      const chunks = splitWord(word, fontPair, size, maxWidth);
      lines.push(...chunks.slice(0, -1));
      currentLine = chunks.at(-1) ?? "";
      continue;
    }

    if (measureText(candidate, fontPair, size) <= maxWidth || !currentLine) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function splitWord(word: string, fontPair: FontPair, size: number, maxWidth: number) {
  const chunks: string[] = [];
  let current = "";

  for (const character of word) {
    const candidate = `${current}${character}`;

    if (current && measureText(candidate, fontPair, size) > maxWidth) {
      chunks.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
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
