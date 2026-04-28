import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { VoucherType } from "@prisma/client";
import { degrees, PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb } from "pdf-lib";
import QRCode from "qrcode";

import { formatVoucherValue } from "@/features/vouchers/lib/voucher-format";
import { type getVoucherDetail } from "@/features/vouchers/lib/voucher-read-models";
import {
  buildVoucherPdfContactLines,
  buildVoucherVerificationUrl,
  resolveVoucherPdfLogo,
  type VoucherPdfLogoAsset,
  VOUCHER_PDF_TEXT_LOGO,
} from "@/features/vouchers/lib/voucher-pdf-core";
import { prisma } from "@/lib/prisma";
import { getSiteSettings, type SiteSettingsRecord } from "@/lib/site-settings";

type VoucherPdfData = NonNullable<Awaited<ReturnType<typeof getVoucherDetail>>>;

export type VoucherPrintPosition = 1;

type VoucherPrintA4PdfOptions = {
  position?: VoucherPrintPosition;
  settings?: SiteSettingsRecord;
  logoAsset?: VoucherPdfLogoAsset | null;
};

type FontPair = {
  primary: PDFFont;
  fallback: PDFFont;
  primaryCharacters: Set<number>;
  fallbackCharacters: Set<number>;
};

type VoucherPrintAssets = {
  regularFont: FontPair;
  boldFont: FontPair;
  qrImage: PDFImage;
  logoImage: PDFImage | null;
};

export const MM_TO_PT = 72 / 25.4;
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const SLOT_WIDTH_MM = 210;
export const SLOT_HEIGHT_MM = 99;
export const VOUCHER_WIDTH_MM = 99;
export const VOUCHER_HEIGHT_MM = 210;

export const A4_WIDTH_PT = mm(A4_WIDTH_MM);
export const A4_HEIGHT_PT = mm(A4_HEIGHT_MM);
export const SLOT_WIDTH_PT = mm(SLOT_WIDTH_MM);
export const SLOT_HEIGHT_PT = mm(SLOT_HEIGHT_MM);
export const VOUCHER_WIDTH_PT = mm(VOUCHER_WIDTH_MM);
export const VOUCHER_HEIGHT_PT = mm(VOUCHER_HEIGHT_MM);

const safeMargin = mm(7);
const fontRegularLatinPath = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff",
);
const fontRegularLatinExtPath = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-sans/files/noto-sans-latin-ext-400-normal.woff",
);
const fontBoldLatinPath = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff",
);
const fontBoldLatinExtPath = path.join(
  process.cwd(),
  "node_modules/@fontsource/noto-sans/files/noto-sans-latin-ext-700-normal.woff",
);

const colors = {
  ink: rgb(0.12, 0.105, 0.095),
  muted: rgb(0.43, 0.39, 0.35),
  accent: rgb(0.72, 0.6, 0.43),
  accentSoft: rgb(0.86, 0.78, 0.67),
  guide: rgb(0.84, 0.79, 0.72),
  background: rgb(0.965, 0.945, 0.915),
  paper: rgb(1, 0.99, 0.965),
  panel: rgb(0.985, 0.965, 0.935),
};

const voucherPrintPosition: VoucherPrintPosition = 1;
const voucherPrintSlotBottomY = mm(198);

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Prague",
});

export function mm(value: number) {
  return value * MM_TO_PT;
}

export function isVoucherPrintPosition(value: number): value is VoucherPrintPosition {
  return value === voucherPrintPosition;
}

export function getVoucherPrintSlotBox(position: VoucherPrintPosition = voucherPrintPosition) {
  assertVoucherPrintPosition(position);

  return {
    x: 0,
    y: voucherPrintSlotBottomY,
    width: SLOT_WIDTH_PT,
    height: SLOT_HEIGHT_PT,
  };
}

export function buildVoucherPrintA4PdfFilename(code: string, position: VoucherPrintPosition = voucherPrintPosition) {
  assertVoucherPrintPosition(position);
  const safeCode = code.replace(/[^A-Za-z0-9-]/g, "");

  return `voucher-${safeCode || "PP"}-tisk-a4.pdf`;
}

export async function generateVoucherPrintA4Pdf(voucher: VoucherPdfData, options: VoucherPrintA4PdfOptions = {}) {
  const position = options.position ?? voucherPrintPosition;
  assertVoucherPrintPosition(position);

  const settings = options.settings ?? (await getSiteSettings());
  const logoAsset =
    options.logoAsset !== undefined
      ? options.logoAsset
      : settings.voucherPdfLogoMediaId
        ? await prisma.mediaAsset.findUnique({
            where: { id: settings.voucherPdfLogoMediaId },
            select: {
              id: true,
              storageProvider: true,
              visibility: true,
              mimeType: true,
              storagePath: true,
              optimizedStoragePath: true,
              optimizedMimeType: true,
            },
          })
        : null;
  const logo = await resolveVoucherPdfLogo(logoAsset);
  const qrPngBytes = await QRCode.toBuffer(buildVoucherVerificationUrl(voucher.code), {
    type: "png",
    margin: 1,
    scale: 10,
    color: {
      dark: "#171311",
      light: "#fffdf8",
    },
  });

  const dlPdf = await PDFDocument.create();
  dlPdf.registerFontkit(fontkit);

  const [regularLatinBytes, regularLatinExtBytes, boldLatinBytes, boldLatinExtBytes] = await Promise.all([
    readFile(fontRegularLatinPath),
    readFile(fontRegularLatinExtPath),
    readFile(fontBoldLatinPath),
    readFile(fontBoldLatinExtPath),
  ]);
  const regularLatinFont = await dlPdf.embedFont(regularLatinBytes, { subset: true });
  const regularLatinExtFont = await dlPdf.embedFont(regularLatinExtBytes, { subset: true });
  const boldLatinFont = await dlPdf.embedFont(boldLatinBytes, { subset: true });
  const boldLatinExtFont = await dlPdf.embedFont(boldLatinExtBytes, { subset: true });
  const qrImage = await dlPdf.embedPng(qrPngBytes);
  const logoImage = logo.kind === "image" ? await embedLogoImage(dlPdf, logo).catch(() => null) : null;
  const portraitPage = dlPdf.addPage([VOUCHER_WIDTH_PT, VOUCHER_HEIGHT_PT]);

  drawVoucherDlPortrait(portraitPage, voucher, settings, {
    regularFont: createFontPair(regularLatinFont, regularLatinExtFont),
    boldFont: createFontPair(boldLatinFont, boldLatinExtFont),
    qrImage,
    logoImage,
  });

  const portraitBytes = await dlPdf.save();
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Tisk A4 dárkového poukazu ${voucher.code}`);
  pdf.setAuthor("PP Studio");
  pdf.setSubject("Tisková A4 varianta dárkového poukazu PP Studio");
  pdf.setCreator("PP Studio administrace");
  pdf.setProducer("PP Studio administrace");

  const [embeddedPortraitPage] = await pdf.embedPdf(portraitBytes, [0]);
  const page = pdf.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
  const slot = getVoucherPrintSlotBox(position);

  drawPrintGuides(page);

  // pdf-lib rotates around the inserted page origin. Translating to the slot's
  // right-bottom corner before a 90deg rotation maps portrait 99x210 mm into
  // the horizontal 210x99 mm A4 slot without changing the portrait layout math.
  page.drawPage(embeddedPortraitPage, {
    x: slot.x + slot.width,
    y: slot.y,
    width: VOUCHER_WIDTH_PT,
    height: VOUCHER_HEIGHT_PT,
    rotate: degrees(90),
  });

  return pdf.save();
}

function assertVoucherPrintPosition(position: number): asserts position is VoucherPrintPosition {
  if (!isVoucherPrintPosition(position)) {
    throw new RangeError("Neplatná tisková pozice voucheru. Tisková A4 varianta podporuje pouze pozici 1.");
  }
}

function drawPrintGuides(page: PDFPage) {
  page.drawLine({
    start: { x: mm(5), y: voucherPrintSlotBottomY },
    end: { x: A4_WIDTH_PT - mm(5), y: voucherPrintSlotBottomY },
    thickness: 0.35,
    color: colors.guide,
    dashArray: [2, 3],
    opacity: 0.55,
  });
}

function drawVoucherDlPortrait(
  page: PDFPage,
  voucher: VoucherPdfData,
  settings: SiteSettingsRecord,
  assets: VoucherPrintAssets,
) {
  const { regularFont, boldFont, qrImage, logoImage } = assets;
  const contentWidth = VOUCHER_WIDTH_PT - safeMargin * 2;
  const centerX = VOUCHER_WIDTH_PT / 2;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: VOUCHER_WIDTH_PT,
    height: VOUCHER_HEIGHT_PT,
    color: colors.background,
  });
  page.drawRectangle({
    x: mm(3),
    y: mm(3),
    width: VOUCHER_WIDTH_PT - mm(6),
    height: VOUCHER_HEIGHT_PT - mm(6),
    color: colors.paper,
    borderColor: colors.accentSoft,
    borderWidth: 0.9,
  });
  page.drawRectangle({
    x: safeMargin - mm(1.5),
    y: safeMargin - mm(1.5),
    width: VOUCHER_WIDTH_PT - (safeMargin - mm(1.5)) * 2,
    height: VOUCHER_HEIGHT_PT - (safeMargin - mm(1.5)) * 2,
    borderColor: rgb(0.91, 0.85, 0.77),
    borderWidth: 0.45,
  });

  const logoTopY = VOUCHER_HEIGHT_PT - mm(16);
  const logoMaxWidth = mm(46);
  const logoMaxHeight = mm(18);

  if (logoImage) {
    const logoBox = getContainedImageBox(logoImage, logoMaxWidth, logoMaxHeight);
    drawContainedImage(page, logoImage, centerX - logoBox.width / 2, logoTopY, logoMaxWidth, logoMaxHeight);
  } else {
    drawCenteredText(page, VOUCHER_PDF_TEXT_LOGO, centerX, logoTopY - mm(5), {
      fontPair: boldFont,
      size: 15,
      color: colors.ink,
    });
  }

  drawCenteredText(page, "kosmetické studio Zlín", centerX, VOUCHER_HEIGHT_PT - mm(39), {
    fontPair: regularFont,
    size: 8.4,
    color: colors.muted,
  });
  page.drawLine({
    start: { x: centerX - mm(16), y: VOUCHER_HEIGHT_PT - mm(47) },
    end: { x: centerX + mm(16), y: VOUCHER_HEIGHT_PT - mm(47) },
    thickness: 0.45,
    color: colors.accent,
    opacity: 0.55,
  });

  drawCenteredText(page, "Dárkový poukaz", centerX, VOUCHER_HEIGHT_PT - mm(61), {
    fontPair: boldFont,
    size: 20,
    color: colors.ink,
  });
  drawWrappedText(page, "Dopřejte si chvíli péče, klidu a krásy.", safeMargin, VOUCHER_HEIGHT_PT - mm(72), contentWidth, {
    fontPair: regularFont,
    size: 8.2,
    lineHeight: 10,
    color: colors.muted,
    align: "center",
  });

  const mainLabel = voucher.type === VoucherType.VALUE ? "Hodnota poukazu" : "Poukaz na službu";
  const mainValue =
    voucher.type === VoucherType.VALUE
      ? formatVoucherValue(voucher)
      : voucher.serviceNameSnapshot ?? "Vybraná služba PP Studio";

  drawCenteredText(page, mainLabel, centerX, VOUCHER_HEIGHT_PT - mm(91), {
    fontPair: regularFont,
    size: 8.1,
    color: colors.muted,
  });
  drawWrappedText(page, mainValue, safeMargin + mm(2), VOUCHER_HEIGHT_PT - mm(103), contentWidth - mm(4), {
    fontPair: boldFont,
    size: voucher.type === VoucherType.VALUE ? 19 : 13.8,
    lineHeight: voucher.type === VoucherType.VALUE ? 22 : 16,
    color: colors.ink,
    align: "center",
    maxLines: voucher.type === VoucherType.VALUE ? 2 : 3,
  });

  const detailY = VOUCHER_HEIGHT_PT - mm(137);
  drawSmallPanel(page, safeMargin, detailY, mm(39), mm(20), "Kód voucheru", voucher.code, regularFont, boldFont);
  drawSmallPanel(
    page,
    VOUCHER_WIDTH_PT - safeMargin - mm(39),
    detailY,
    mm(39),
    mm(20),
    "Platnost do",
    voucher.validUntil ? dateFormatter.format(voucher.validUntil) : "Bez omezení",
    regularFont,
    boldFont,
  );

  const qrBoxSize = mm(38);
  const qrBoxX = centerX - qrBoxSize / 2;
  const qrBoxY = mm(36);
  page.drawRectangle({
    x: qrBoxX,
    y: qrBoxY,
    width: qrBoxSize,
    height: qrBoxSize,
    color: colors.panel,
    borderColor: rgb(0.88, 0.8, 0.7),
    borderWidth: 0.65,
  });
  page.drawImage(qrImage, {
    x: qrBoxX + mm(3),
    y: qrBoxY + mm(3),
    width: qrBoxSize - mm(6),
    height: qrBoxSize - mm(6),
  });
  drawCenteredText(page, "Ověření voucheru", centerX, qrBoxY - mm(5), {
    fontPair: boldFont,
    size: 8.1,
    color: colors.ink,
  });
  drawWrappedText(page, "Naskenujte QR kód pro ověření platnosti.", safeMargin, qrBoxY - mm(11), contentWidth, {
    fontPair: regularFont,
    size: 7.2,
    lineHeight: 8.6,
    color: colors.muted,
    align: "center",
    maxLines: 2,
  });

  const contactLines = buildVoucherPdfContactLines(settings);
  contactLines.forEach((line, index) => {
    drawWrappedText(page, line, safeMargin, mm(18) - index * mm(4.2), contentWidth, {
      fontPair: regularFont,
      size: 7.1,
      lineHeight: 8.2,
      color: colors.muted,
      align: "center",
      maxLines: 1,
    });
  });
}

async function embedLogoImage(
  pdf: PDFDocument,
  logo: Awaited<ReturnType<typeof resolveVoucherPdfLogo>> & { kind: "image" },
) {
  if (logo.mimeType === "image/png") {
    return pdf.embedPng(logo.bytes);
  }

  return pdf.embedJpg(logo.bytes);
}

function drawSmallPanel(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  regularFont: FontPair,
  boldFont: FontPair,
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: colors.panel,
    borderColor: rgb(0.9, 0.84, 0.76),
    borderWidth: 0.45,
  });
  drawCenteredText(page, label, x + width / 2, y + height - mm(6.2), {
    fontPair: regularFont,
    size: 6.9,
    color: colors.muted,
  });
  drawWrappedText(page, value, x + mm(2), y + height - mm(12.5), width - mm(4), {
    fontPair: boldFont,
    size: 8.1,
    lineHeight: 9,
    color: colors.ink,
    align: "center",
    maxLines: 2,
  });
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  centerX: number,
  y: number,
  options: Omit<NonNullable<Parameters<PDFPage["drawText"]>[1]>, "font"> & {
    fontPair: FontPair;
    size: number;
  },
) {
  drawText(page, text, centerX - measureText(text, options.fontPair, options.size) / 2, y, options);
}

function drawContainedImage(page: PDFPage, image: PDFImage, x: number, topY: number, maxWidth: number, maxHeight: number) {
  const { width, height } = getContainedImageBox(image, maxWidth, maxHeight);

  page.drawImage(image, {
    x,
    y: topY - height,
    width,
    height,
  });
}

function getContainedImageBox(image: PDFImage, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);

  return {
    width: image.width * scale,
    height: image.height * scale,
  };
}

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: Omit<NonNullable<Parameters<PDFPage["drawText"]>[1]>, "font"> & {
    fontPair: FontPair;
    size: number;
  },
) {
  drawTextLine(page, text, x, y, options);
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  options: Omit<NonNullable<Parameters<PDFPage["drawText"]>[1]>, "font"> & {
    fontPair: FontPair;
    size: number;
    lineHeight: number;
    align?: "left" | "center" | "right";
    maxLines?: number;
  },
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = measureText(candidate, options.fontPair, options.size);

    if (width <= maxWidth || !currentLine) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  const visibleLines = options.maxLines ? lines.slice(0, options.maxLines) : lines;

  visibleLines.forEach((line, index) => {
    const lineWidth = measureText(line, options.fontPair, options.size);
    const offsetX =
      options.align === "center"
        ? Math.max((maxWidth - lineWidth) / 2, 0)
        : options.align === "right"
          ? Math.max(maxWidth - lineWidth, 0)
          : 0;

    drawTextLine(page, line, x + offsetX, y - index * options.lineHeight, {
      ...options,
    });
  });
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

function drawTextLine(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  options: Omit<NonNullable<Parameters<PDFPage["drawText"]>[1]>, "font"> & {
    fontPair: FontPair;
    size: number;
  },
) {
  let cursorX = x;
  let run = "";
  let runFont: PDFFont | null = null;
  const { fontPair, ...drawOptions } = options;

  for (const character of text) {
    const characterFont = pickFont(character, fontPair);

    if (runFont && characterFont !== runFont) {
      page.drawText(run, { ...drawOptions, font: runFont, x: cursorX, y });
      cursorX += runFont.widthOfTextAtSize(run, options.size);
      run = character;
    } else {
      run += character;
    }

    runFont = characterFont;
  }

  if (run && runFont) {
    page.drawText(run, { ...drawOptions, font: runFont, x: cursorX, y });
  }
}
