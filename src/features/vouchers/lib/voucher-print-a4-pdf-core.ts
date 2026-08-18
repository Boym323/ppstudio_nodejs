import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { VoucherType } from "@/generated/prisma/browser";
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

type VoucherPrintA4PdfOptions = {
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

type ThemeColorInput = `#${string}` | `rgb(${string})` | readonly [number, number, number];

export const MM_TO_PT = 72 / 25.4;
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const SLOT_WIDTH_MM = 210;
export const SLOT_HEIGHT_MM = 96;
export const VOUCHER_WIDTH_MM = 99;
export const VOUCHER_HEIGHT_MM = 210;

export const A4_WIDTH_PT = mm(A4_WIDTH_MM);
export const A4_HEIGHT_PT = mm(A4_HEIGHT_MM);
export const SLOT_WIDTH_PT = mm(SLOT_WIDTH_MM);
export const SLOT_HEIGHT_PT = mm(SLOT_HEIGHT_MM);
export const VOUCHER_WIDTH_PT = mm(VOUCHER_WIDTH_MM);
export const VOUCHER_HEIGHT_PT = mm(VOUCHER_HEIGHT_MM);

export const VOUCHER_PRINT_THEME_INPUT = {
  // Primární texty (nadpisy, hlavní hodnota voucheru, fallback textové logo).
  ink: "#141211",
  // Sekundární texty (podtitulky, doplňkové informace, kontakt).
  muted: "rgb(71, 65, 59)",
  // Akcentní prvky (dekorativní linky, jemné oddělení sekcí).
  accent: "#9e7d54",
  // Světlejší akcent (oddělovače v info blocích).
  accentSoft: "#c2a380",
  // Tiskové vodítko/ořezová čára na A4.
  guide: "#ad9475",
  // Vnější pozadí samotného voucheru.
  background: "#f6f1e9",
  // Hlavní „papírová“ plocha voucheru.
  paper: "#e7dacd",
  // Rezerva pro případné vnitřní panely (aktuálně minimálně využité).
  panel: "#fbf6ef",
  // Barva okolního A4 papíru mimo voucher.
  a4Paper: "#ffffff",
  // Barva 3mm trimu voucheru na A4.
  voucherTrim: "#e7dacd",
  // Tenký rámeček uvnitř bezpečné zóny.
  frameBorder: "#c7a67f",
  // Pozadí rámečku kolem QR.
  qrBackground: "#fffcfb",
  // Ohraničení rámečku QR.
  qrBorder: "#bd9e75",
} as const;

// Výsledná paleta pro pdf-lib (vše převedeno na rgb 0..1).
export const VOUCHER_PRINT_THEME = buildPdfTheme(VOUCHER_PRINT_THEME_INPUT);

// QR knihovna očekává CSS-like barvy, proto držíme zvlášť.
const QR_COLORS = {
  dark: "#171311",
  light: "#fffdf8",
} as const;

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

const edgeTrimSize = mm(3);
const voucherArtworkBottomY = mm(198);
const innerFrameInset = mm(1.5);
const qrFramePadding = mm(2.8);
// Centrální layout voucheru: souřadnice/rozměry v pt pro rychlé ladění bez hledání magic numbers.
const VOUCHER_PRINT_LAYOUT = {
  outerInset: mm(3),
  innerFrameInset,
  logoTopY: VOUCHER_HEIGHT_PT - mm(15),
  logoTextOffsetY: mm(5),
  logoMaxWidth: mm(56),
  logoMaxHeight: mm(21),
  brandTextY: VOUCHER_HEIGHT_PT - mm(42),
  brandSeparatorY: VOUCHER_HEIGHT_PT - mm(46),
  brandSeparatorHalfWidth: mm(14),
  titleY: VOUCHER_HEIGHT_PT - mm(60),
  subtitleY: VOUCHER_HEIGHT_PT - mm(70),
  mainLabelY: VOUCHER_HEIGHT_PT - mm(90),
  mainValueY: VOUCHER_HEIGHT_PT - mm(104),
  mainValueInsetX: mm(2),
  mainValueInsetWidth: mm(4),
  validityInfoY: mm(84),
  validityInfoWidth: mm(50),
  qrBoxSize: mm(36),
  qrBoxY: mm(38),
  voucherCodeInfoY: mm(29.2),
  voucherCodeInfoWidth: mm(54),
  contactStartY: mm(13.5),
  contactGapY: mm(4.7),
} as const;

export const topSlotBottomY = voucherArtworkBottomY + edgeTrimSize;

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Prague",
});

export function mm(value: number) {
  return value * MM_TO_PT;
}

function buildPdfTheme<T extends Record<string, ThemeColorInput>>(theme: T): { [K in keyof T]: ReturnType<typeof rgb> } {
  const result = {} as { [K in keyof T]: ReturnType<typeof rgb> };

  for (const key of Object.keys(theme) as Array<keyof T>) {
    result[key] = toPdfColor(theme[key]);
  }

  return result;
}

function toPdfColor(input: ThemeColorInput) {
  if (Array.isArray(input)) {
    const [r, g, b] = input;

    return rgb(normalizeColorChannel(r), normalizeColorChannel(g), normalizeColorChannel(b));
  }

  if (typeof input === "string" && isHexColor(input)) {
    return rgbFromHex(input);
  }

  if (typeof input === "string") {
    return rgbFromCssRgb(input);
  }

  throw new Error("Unsupported voucher theme color input.");
}

function isHexColor(input: string): input is `#${string}` {
  return input.startsWith("#");
}

function rgbFromHex(hex: `#${string}`) {
  const normalizedHex = hex.slice(1);
  const fullHex =
    normalizedHex.length === 3
      ? normalizedHex
          .split("")
          .map((value) => `${value}${value}`)
          .join("")
      : normalizedHex;

  if (!/^[0-9a-fA-F]{6}$/.test(fullHex)) {
    throw new Error(`Invalid HEX color "${hex}" in voucher print theme.`);
  }

  const r = Number.parseInt(fullHex.slice(0, 2), 16);
  const g = Number.parseInt(fullHex.slice(2, 4), 16);
  const b = Number.parseInt(fullHex.slice(4, 6), 16);

  return rgb(r / 255, g / 255, b / 255);
}

function rgbFromCssRgb(input: `rgb(${string})`) {
  const match = input.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/i);

  if (!match) {
    throw new Error(`Invalid rgb(...) color "${input}" in voucher print theme.`);
  }

  const r = Number.parseFloat(match[1]);
  const g = Number.parseFloat(match[2]);
  const b = Number.parseFloat(match[3]);

  return rgb(normalizeColorChannel(r), normalizeColorChannel(g), normalizeColorChannel(b));
}

function normalizeColorChannel(value: number) {
  // Umožní míchat zápis 0..1 i 0..255 bez ručních přepočtů.
  if (value <= 1) {
    return value;
  }

  return value / 255;
}

export function getVoucherPrintSlotBox() {
  return {
    x: 0,
    y: topSlotBottomY,
    width: SLOT_WIDTH_PT,
    height: SLOT_HEIGHT_PT,
  };
}

export function buildVoucherPrintA4PdfFilename(code: string) {
  const safeCode = code.replace(/[^A-Za-z0-9-]/g, "");

  return `voucher-${safeCode || "PP"}-tisk-a4.pdf`;
}

export async function generateVoucherPrintA4Pdf(voucher: VoucherPdfData, options: VoucherPrintA4PdfOptions = {}) {
  const settings = options.settings ?? (await getSiteSettings());
  const logoAsset =
    options.logoAsset !== undefined
      ? options.logoAsset
      : settings.voucherPdfLogoMediaId
        ? await prisma.mediaAsset.findFirst({
            where: { id: settings.voucherPdfLogoMediaId, deletionRequestedAt: null },
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
    color: QR_COLORS,
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
  const slot = getVoucherPrintSlotBox();

  // pdf-lib rotates around the inserted page origin. Translating to the slot's
  // right-bottom corner before a 90deg rotation maps portrait 99x210 mm into
  // the horizontal A4 slot without changing the portrait layout math. The
  // source artwork stays at the original size, while the outer 3mm trim is
  // normalized to the voucher background inside the clean A4 cut area.
  page.drawPage(embeddedPortraitPage, {
    x: slot.x + slot.width,
    y: voucherArtworkBottomY,
    width: VOUCHER_WIDTH_PT,
    height: VOUCHER_HEIGHT_PT,
    rotate: degrees(90),
  });
  drawA4TrimMasks(page);
  drawPrintGuides(page);

  return pdf.save();
}

function drawA4TrimMasks(page: PDFPage) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: A4_WIDTH_PT,
    height: topSlotBottomY,
    color: VOUCHER_PRINT_THEME.a4Paper,
  });
  page.drawRectangle({
    x: 0,
    y: topSlotBottomY,
    width: edgeTrimSize,
    height: A4_HEIGHT_PT - topSlotBottomY,
    color: VOUCHER_PRINT_THEME.voucherTrim,
  });
  page.drawRectangle({
    x: A4_WIDTH_PT - edgeTrimSize,
    y: topSlotBottomY,
    width: edgeTrimSize,
    height: A4_HEIGHT_PT - topSlotBottomY,
    color: VOUCHER_PRINT_THEME.voucherTrim,
  });
  page.drawRectangle({
    x: 0,
    y: A4_HEIGHT_PT - edgeTrimSize,
    width: A4_WIDTH_PT,
    height: edgeTrimSize,
    color: VOUCHER_PRINT_THEME.voucherTrim,
  });
}

function drawPrintGuides(page: PDFPage) {
  page.drawLine({
    start: { x: 0, y: topSlotBottomY },
    end: { x: A4_WIDTH_PT, y: topSlotBottomY },
    thickness: 0.2,
    color: VOUCHER_PRINT_THEME.guide,
    dashArray: [2, 3],
    opacity: 0.42,
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
  const mainLabel = voucher.type === VoucherType.VALUE ? "Hodnota poukazu" : "Poukaz na službu";
  const mainValue =
    voucher.type === VoucherType.VALUE
      ? formatVoucherValue(voucher)
      : voucher.serviceNameSnapshot ?? "Vybraná služba PP Studio";

  drawVoucherBaseFrame(page);
  drawVoucherHeader(page, centerX, regularFont, boldFont, logoImage);
  drawVoucherMainValue(page, centerX, contentWidth, voucher.type, mainLabel, mainValue, regularFont, boldFont);
  drawVoucherFooter(page, centerX, contentWidth, voucher, settings, qrImage, regularFont, boldFont);
}

function drawVoucherBaseFrame(page: PDFPage) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: VOUCHER_WIDTH_PT,
    height: VOUCHER_HEIGHT_PT,
    color: VOUCHER_PRINT_THEME.background,
  });
  page.drawRectangle({
    x: VOUCHER_PRINT_LAYOUT.outerInset,
    y: VOUCHER_PRINT_LAYOUT.outerInset,
    width: VOUCHER_WIDTH_PT - VOUCHER_PRINT_LAYOUT.outerInset * 2,
    height: VOUCHER_HEIGHT_PT - VOUCHER_PRINT_LAYOUT.outerInset * 2,
    color: VOUCHER_PRINT_THEME.paper,
  });
  page.drawRectangle({
    x: safeMargin - VOUCHER_PRINT_LAYOUT.innerFrameInset,
    y: safeMargin - VOUCHER_PRINT_LAYOUT.innerFrameInset,
    width: VOUCHER_WIDTH_PT - (safeMargin - VOUCHER_PRINT_LAYOUT.innerFrameInset) * 2,
    height: VOUCHER_HEIGHT_PT - (safeMargin - VOUCHER_PRINT_LAYOUT.innerFrameInset) * 2,
    borderColor: VOUCHER_PRINT_THEME.frameBorder,
    borderWidth: 0.52,
  });
}

function drawVoucherHeader(page: PDFPage, centerX: number, regularFont: FontPair, boldFont: FontPair, logoImage: PDFImage | null) {
  if (logoImage) {
    const logoBox = getContainedImageBox(
      logoImage,
      VOUCHER_PRINT_LAYOUT.logoMaxWidth,
      VOUCHER_PRINT_LAYOUT.logoMaxHeight,
    );
    drawContainedImage(
      page,
      logoImage,
      centerX - logoBox.width / 2,
      VOUCHER_PRINT_LAYOUT.logoTopY,
      VOUCHER_PRINT_LAYOUT.logoMaxWidth,
      VOUCHER_PRINT_LAYOUT.logoMaxHeight,
    );
  } else {
    drawCenteredText(page, VOUCHER_PDF_TEXT_LOGO, centerX, VOUCHER_PRINT_LAYOUT.logoTopY - VOUCHER_PRINT_LAYOUT.logoTextOffsetY, {
      fontPair: boldFont,
      size: 16.5,
      color: VOUCHER_PRINT_THEME.ink,
    });
  }

  drawCenteredText(page, "COSMETICS & LAMINATIONS", centerX, VOUCHER_PRINT_LAYOUT.brandTextY, {
    fontPair: regularFont,
    size: 8.4,
    color: VOUCHER_PRINT_THEME.muted,
  });
  page.drawLine({
    start: { x: centerX - VOUCHER_PRINT_LAYOUT.brandSeparatorHalfWidth, y: VOUCHER_PRINT_LAYOUT.brandSeparatorY },
    end: { x: centerX + VOUCHER_PRINT_LAYOUT.brandSeparatorHalfWidth, y: VOUCHER_PRINT_LAYOUT.brandSeparatorY },
    thickness: 0.42,
    color: VOUCHER_PRINT_THEME.accent,
    opacity: 0.58,
  });
  drawCenteredText(page, "Dárkový poukaz", centerX, VOUCHER_PRINT_LAYOUT.titleY, {
    fontPair: boldFont,
    size: 17.5,
    color: VOUCHER_PRINT_THEME.ink,
  });
}

function drawVoucherMainValue(
  page: PDFPage,
  centerX: number,
  contentWidth: number,
  voucherType: VoucherType,
  mainLabel: string,
  mainValue: string,
  regularFont: FontPair,
  boldFont: FontPair,
) {
  drawWrappedText(page, "Dopřejte si chvíli péče, klidu a krásy.", safeMargin, VOUCHER_PRINT_LAYOUT.subtitleY, contentWidth, {
    fontPair: regularFont,
    size: 8.2,
    lineHeight: 10,
    color: VOUCHER_PRINT_THEME.muted,
    align: "center",
  });
  drawCenteredText(page, mainLabel, centerX, VOUCHER_PRINT_LAYOUT.mainLabelY, {
    fontPair: regularFont,
    size: 8.1,
    color: VOUCHER_PRINT_THEME.muted,
  });
  drawWrappedText(
    page,
    mainValue,
    safeMargin + VOUCHER_PRINT_LAYOUT.mainValueInsetX,
    VOUCHER_PRINT_LAYOUT.mainValueY,
    contentWidth - VOUCHER_PRINT_LAYOUT.mainValueInsetWidth,
    {
      fontPair: boldFont,
      size: voucherType === VoucherType.VALUE ? 18.5 : 13.4,
      lineHeight: voucherType === VoucherType.VALUE ? 23 : 16.5,
      color: VOUCHER_PRINT_THEME.ink,
      align: "center",
      maxLines: 2,
    },
  );
}

function drawVoucherFooter(
  page: PDFPage,
  centerX: number,
  contentWidth: number,
  voucher: VoucherPdfData,
  settings: SiteSettingsRecord,
  qrImage: PDFImage,
  regularFont: FontPair,
  boldFont: FontPair,
) {
  drawInfoBlock(
    page,
    centerX,
    VOUCHER_PRINT_LAYOUT.validityInfoY,
    VOUCHER_PRINT_LAYOUT.validityInfoWidth,
    "Platnost do",
    voucher.validUntil ? dateFormatter.format(voucher.validUntil) : "Bez omezení",
    regularFont,
    boldFont,
  );

  drawVoucherQrBlock(page, centerX, qrImage);

  drawInfoBlock(
    page,
    centerX,
    VOUCHER_PRINT_LAYOUT.voucherCodeInfoY,
    VOUCHER_PRINT_LAYOUT.voucherCodeInfoWidth,
    "Kód voucheru",
    voucher.code,
    regularFont,
    boldFont,
  );

  const contactLines = buildVoucherPrintContactLines(settings);
  contactLines.forEach((line, index) => {
    drawWrappedText(
      page,
      line,
      safeMargin,
      VOUCHER_PRINT_LAYOUT.contactStartY - index * VOUCHER_PRINT_LAYOUT.contactGapY,
      contentWidth,
      {
        fontPair: regularFont,
        size: 6.8,
        lineHeight: 8.4,
        color: VOUCHER_PRINT_THEME.muted,
        align: "center",
        maxLines: 1,
      },
    );
  });
}

function drawVoucherQrBlock(page: PDFPage, centerX: number, qrImage: PDFImage) {
  const qrBoxX = centerX - VOUCHER_PRINT_LAYOUT.qrBoxSize / 2;

  page.drawRectangle({
    x: qrBoxX,
    y: VOUCHER_PRINT_LAYOUT.qrBoxY,
    width: VOUCHER_PRINT_LAYOUT.qrBoxSize,
    height: VOUCHER_PRINT_LAYOUT.qrBoxSize,
    color: VOUCHER_PRINT_THEME.qrBackground,
    borderColor: VOUCHER_PRINT_THEME.qrBorder,
    borderWidth: 0.48,
  });
  page.drawImage(qrImage, {
    x: qrBoxX + qrFramePadding,
    y: VOUCHER_PRINT_LAYOUT.qrBoxY + qrFramePadding,
    width: VOUCHER_PRINT_LAYOUT.qrBoxSize - qrFramePadding * 2,
    height: VOUCHER_PRINT_LAYOUT.qrBoxSize - qrFramePadding * 2,
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

function buildVoucherPrintContactLines(settings: SiteSettingsRecord) {
  const [addressLine, contactLine] = buildVoucherPdfContactLines(settings);
  const contactParts = contactLine?.split(" · ").map((part) => part.trim()).filter(Boolean) ?? [];
  const [phone, email, domain] = contactParts;

  return [
    [addressLine, phone].filter(Boolean).join(" · "),
    [email, domain].filter(Boolean).join(" · "),
  ].filter(Boolean);
}

function drawInfoBlock(
  page: PDFPage,
  centerX: number,
  y: number,
  width: number,
  label: string,
  value: string,
  regularFont: FontPair,
  boldFont: FontPair,
) {
  const x = centerX - width / 2;

  page.drawLine({
    start: { x, y: y + mm(3.4) },
    end: { x: x + width, y: y + mm(3.4) },
    thickness: 0.36,
    color: VOUCHER_PRINT_THEME.accentSoft,
    opacity: 0.7,
  });
  drawCenteredText(page, label, centerX, y, {
    fontPair: regularFont,
    size: 6.8,
    color: VOUCHER_PRINT_THEME.muted,
  });
  drawWrappedText(page, value, x, y - mm(6.1), width, {
    fontPair: boldFont,
    size: 8.2,
    lineHeight: 9.2,
    color: VOUCHER_PRINT_THEME.ink,
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
