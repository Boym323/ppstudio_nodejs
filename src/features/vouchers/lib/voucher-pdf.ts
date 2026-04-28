import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { VoucherType } from "@prisma/client";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import QRCode from "qrcode";

import { siteConfig } from "@/config/site";
import { formatVoucherValue } from "@/features/vouchers/lib/voucher-format";
import { type getVoucherDetail } from "@/features/vouchers/lib/voucher-read-models";

type VoucherPdfData = NonNullable<Awaited<ReturnType<typeof getVoucherDetail>>>;

const pageWidth = 595.28;
const pageHeight = 419.53;
const margin = 32;
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

type FontPair = {
  primary: PDFFont;
  fallback: PDFFont;
  primaryCharacters: Set<number>;
  fallbackCharacters: Set<number>;
};

const colors = {
  ink: rgb(0.09, 0.075, 0.067),
  muted: rgb(0.43, 0.39, 0.36),
  accent: rgb(0.745, 0.627, 0.471),
  accentSoft: rgb(0.86, 0.76, 0.65),
  background: rgb(0.965, 0.945, 0.92),
  paper: rgb(1, 0.99, 0.965),
  panel: rgb(0.98, 0.955, 0.925),
};

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Prague",
});

export function buildVoucherPdfFilename(code: string) {
  const safeCode = code.replace(/[^A-Za-z0-9-]/g, "");

  return `voucher-${safeCode || "PP"}.pdf`;
}

export function buildVoucherVerificationUrl(code: string, baseUrl = siteConfig.url) {
  const url = new URL("/vouchery/overeni", baseUrl);
  url.searchParams.set("code", code);

  return url.toString();
}

export async function generateVoucherPdf(voucher: VoucherPdfData) {
  const [regularLatinBytes, regularLatinExtBytes, boldLatinBytes, boldLatinExtBytes, qrPngBytes] = await Promise.all([
    readFile(fontRegularLatinPath),
    readFile(fontRegularLatinExtPath),
    readFile(fontBoldLatinPath),
    readFile(fontBoldLatinExtPath),
    QRCode.toBuffer(buildVoucherVerificationUrl(voucher.code), {
      type: "png",
      margin: 1,
      scale: 8,
      color: {
        dark: "#171311",
        light: "#fffdf8",
      },
    }),
  ]);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Dárkový poukaz ${voucher.code}`);
  pdf.setAuthor("PP Studio");
  pdf.setSubject("Dárkový poukaz PP Studio");
  pdf.setCreator("PP Studio administrace");
  pdf.setProducer("PP Studio administrace");

  const regularLatinFont = await pdf.embedFont(regularLatinBytes, { subset: true });
  const regularLatinExtFont = await pdf.embedFont(regularLatinExtBytes, { subset: true });
  const boldLatinFont = await pdf.embedFont(boldLatinBytes, { subset: true });
  const boldLatinExtFont = await pdf.embedFont(boldLatinExtBytes, { subset: true });
  const regularFont = createFontPair(regularLatinFont, regularLatinExtFont);
  const boldFont = createFontPair(boldLatinFont, boldLatinExtFont);
  const qrImage = await pdf.embedPng(qrPngBytes);
  const page = pdf.addPage([pageWidth, pageHeight]);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: colors.background,
  });
  page.drawRectangle({
    x: margin,
    y: margin,
    width: pageWidth - margin * 2,
    height: pageHeight - margin * 2,
    color: colors.paper,
    borderColor: colors.accentSoft,
    borderWidth: 1.2,
  });
  page.drawRectangle({
    x: margin + 10,
    y: margin + 10,
    width: pageWidth - margin * 2 - 20,
    height: pageHeight - margin * 2 - 20,
    borderColor: rgb(0.91, 0.84, 0.75),
    borderWidth: 0.6,
  });

  const leftX = margin + 34;
  const rightX = pageWidth - margin - 156;
  const topY = pageHeight - margin - 46;

  drawText(page, "PP Studio", leftX, topY, {
    fontPair: boldFont,
    size: 16,
    color: colors.ink,
  });
  drawText(page, "Zlín", leftX, topY - 20, {
    fontPair: regularFont,
    size: 9,
    color: colors.muted,
  });

  drawText(page, "Dárkový poukaz", leftX, topY - 70, {
    fontPair: boldFont,
    size: 34,
    color: colors.ink,
  });

  const mainLabel = voucher.type === VoucherType.VALUE ? "Hodnota poukazu" : "Poukaz na službu";
  const mainValue =
    voucher.type === VoucherType.VALUE
      ? formatVoucherValue(voucher)
      : voucher.serviceNameSnapshot ?? "Vybraná služba PP Studio";

  drawText(page, mainLabel, leftX, topY - 116, {
    fontPair: regularFont,
    size: 10,
    color: colors.muted,
  });
  drawWrappedText(page, mainValue, leftX, topY - 142, 312, {
    fontPair: boldFont,
    size: voucher.type === VoucherType.VALUE ? 30 : 22,
    lineHeight: voucher.type === VoucherType.VALUE ? 34 : 27,
    color: colors.ink,
  });

  const detailsY = 129;
  drawDetail(page, "Kód voucheru", voucher.code, leftX, detailsY, regularFont, boldFont);
  drawDetail(page, "Platnost do", voucher.validUntil ? dateFormatter.format(voucher.validUntil) : "Bez omezení", leftX + 170, detailsY, regularFont, boldFont);

  page.drawRectangle({
    x: rightX - 10,
    y: 104,
    width: 132,
    height: 132,
    color: colors.panel,
    borderColor: rgb(0.88, 0.8, 0.7),
    borderWidth: 0.8,
  });
  page.drawImage(qrImage, {
    x: rightX + 2,
    y: 116,
    width: 108,
    height: 108,
  });
  drawWrappedText(page, "Ověření voucheru", rightX - 2, 82, 116, {
    fontPair: boldFont,
    size: 9,
    lineHeight: 11,
    color: colors.ink,
    align: "center",
  });

  drawWrappedText(
    page,
    [
      "Poukaz je možné uplatnit při rezervaci nebo osobně v salonu.",
      "Poukaz není směnitelný za hotovost.",
      "Hodnotový poukaz lze čerpat postupně.",
      "Poukaz na službu je určený pro uvedenou službu.",
    ].join(" "),
    leftX,
    58,
    470,
    {
      fontPair: regularFont,
      size: 8.5,
      lineHeight: 12,
      color: colors.muted,
    },
  );

  return pdf.save();
}

function drawDetail(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  regularFont: FontPair,
  boldFont: FontPair,
) {
  drawText(page, label, x, y, {
    fontPair: regularFont,
    size: 9,
    color: colors.muted,
  });
  drawText(page, value, x, y - 20, {
    fontPair: boldFont,
    size: 13,
    color: colors.ink,
  });
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
    align?: "left" | "center";
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

  lines.forEach((line, index) => {
    const lineWidth = measureText(line, options.fontPair, options.size);
    const offsetX = options.align === "center" ? Math.max((maxWidth - lineWidth) / 2, 0) : 0;

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
