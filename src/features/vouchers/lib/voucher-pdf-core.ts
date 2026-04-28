import { readFile } from "node:fs/promises";
import path from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { MediaAssetVisibility, MediaStorageProvider, VoucherType } from "@prisma/client";
import { PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb } from "pdf-lib";
import QRCode from "qrcode";

import { env } from "@/config/env";
import { siteConfig } from "@/config/site";
import { formatVoucherValue } from "@/features/vouchers/lib/voucher-format";
import { type getVoucherDetail } from "@/features/vouchers/lib/voucher-read-models";
import { localMediaStorage } from "@/lib/media/local-media-storage";
import { prisma } from "@/lib/prisma";
import { getSalonAddressLine, getSiteSettings, type SiteSettingsRecord } from "@/lib/site-settings";

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

export type VoucherPdfLogoAsset = {
  id: string;
  storageProvider: MediaStorageProvider;
  visibility: MediaAssetVisibility;
  mimeType: string;
  storagePath: string;
  optimizedStoragePath: string | null;
  optimizedMimeType: string | null;
};

export type VoucherPdfLogo =
  | {
      kind: "image";
      bytes: Buffer;
      mimeType: string;
    }
  | {
      kind: "text";
      text: typeof VOUCHER_PDF_TEXT_LOGO;
    };

type VoucherPdfOptions = {
  settings?: SiteSettingsRecord;
  logoAsset?: VoucherPdfLogoAsset | null;
};

export const VOUCHER_PDF_TEXT_LOGO = "PP Studio";

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

export function buildVoucherPdfTerms(voucher: Pick<VoucherPdfData, "type">) {
  const typedTerm =
    voucher.type === VoucherType.VALUE
      ? "Hodnotový poukaz lze čerpat postupně."
      : "Poukaz je určený pro uvedenou službu.";

  return [
    "Poukaz je možné uplatnit při rezervaci nebo osobně v salonu.",
    "Poukaz není směnitelný za hotovost.",
    typedTerm,
  ];
}

export function buildVoucherPdfContactLines(
  settings: Pick<SiteSettingsRecord, "addressLine" | "postalCode" | "city" | "phone" | "contactEmail">,
) {
  const hasAddress = [settings.addressLine, settings.postalCode, settings.city].some((value) => value.trim().length > 0);
  const contactItems = [settings.phone.trim(), settings.contactEmail.trim(), resolveVoucherPublicDomain()].filter(Boolean);

  return [hasAddress ? getSalonAddressLine(settings).trim() : "", contactItems.join(" · ")].filter(Boolean);
}

export async function resolveVoucherPdfLogo(asset: VoucherPdfLogoAsset | null | undefined): Promise<VoucherPdfLogo> {
  if (!asset || asset.storageProvider !== MediaStorageProvider.LOCAL) {
    return { kind: "text", text: VOUCHER_PDF_TEXT_LOGO };
  }

  const storagePath = asset.optimizedStoragePath ?? asset.storagePath;
  const mimeType = asset.optimizedMimeType ?? asset.mimeType;

  if (!isPdfEmbeddableImage(mimeType)) {
    return { kind: "text", text: VOUCHER_PDF_TEXT_LOGO };
  }

  try {
    const bytes = await localMediaStorage.readFile(asset.visibility, storagePath);
    return {
      kind: "image",
      bytes,
      mimeType,
    };
  } catch {
    return { kind: "text", text: VOUCHER_PDF_TEXT_LOGO };
  }
}

export async function generateVoucherPdf(voucher: VoucherPdfData, options: VoucherPdfOptions = {}) {
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
  const logoImage = logo.kind === "image" ? await embedLogoImage(pdf, logo).catch(() => null) : null;
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
  const rightX = pageWidth - margin - 148;
  const topY = pageHeight - margin - 34;
  const logoMaxWidth = 142;
  const logoMaxHeight = 52;
  const logoBox = logoImage ? getContainedImageBox(logoImage, logoMaxWidth, logoMaxHeight) : null;
  const logoBlockHeight = logoBox ? logoBox.height : 22;
  const subtitleSize = 8.6;
  const subtitleGap = 12;
  const subtitleY = topY - logoBlockHeight - subtitleGap;
  const titleGap = 36;
  const titleY = subtitleY - titleGap;

  if (logoImage) {
    drawContainedImage(page, logoImage, leftX, topY - 2, logoMaxWidth, logoMaxHeight);
  } else {
    drawText(page, VOUCHER_PDF_TEXT_LOGO, leftX, topY, {
      fontPair: boldFont,
      size: 17,
      color: colors.ink,
    });
  }
  drawText(page, "kosmetické studio Zlín", leftX, subtitleY, {
    fontPair: regularFont,
    size: subtitleSize,
    color: colors.muted,
  });

  drawText(page, "Dárkový poukaz", leftX, titleY, {
    fontPair: boldFont,
    size: 34,
    color: colors.ink,
  });
  drawText(page, "Dopřejte si chvíli péče, klidu a krásy.", leftX, titleY - 24, {
    fontPair: regularFont,
    size: 10,
    color: colors.muted,
  });

  const mainLabel = voucher.type === VoucherType.VALUE ? "Hodnota poukazu" : "Poukaz na službu";
  const mainValue =
    voucher.type === VoucherType.VALUE
      ? formatVoucherValue(voucher)
      : voucher.serviceNameSnapshot ?? "Vybraná služba PP Studio";

  drawText(page, mainLabel, leftX, titleY - 60, {
    fontPair: regularFont,
    size: 10,
    color: colors.muted,
  });
  drawWrappedText(page, mainValue, leftX, titleY - 86, 300, {
    fontPair: boldFont,
    size: voucher.type === VoucherType.VALUE ? 30 : 22,
    lineHeight: voucher.type === VoucherType.VALUE ? 34 : 27,
    color: colors.ink,
    maxLines: voucher.type === VoucherType.VALUE ? 2 : 3,
  });

  const detailsY = 126;
  drawDetail(page, "Kód voucheru", voucher.code, leftX, detailsY, regularFont, boldFont);
  drawDetail(page, "Platnost do", voucher.validUntil ? dateFormatter.format(voucher.validUntil) : "Bez omezení", leftX + 170, detailsY, regularFont, boldFont);

  page.drawRectangle({
    x: rightX - 8,
    y: 126,
    width: 132,
    height: 132,
    color: colors.panel,
    borderColor: rgb(0.88, 0.8, 0.7),
    borderWidth: 0.8,
  });
  page.drawImage(qrImage, {
    x: rightX + 4,
    y: 138,
    width: 108,
    height: 108,
  });
  drawWrappedText(page, "Ověření voucheru", rightX - 2, 109, 116, {
    fontPair: regularFont,
    size: 8.2,
    lineHeight: 10,
    color: colors.ink,
    align: "center",
  });
  drawWrappedText(page, "Naskenujte QR kód pro ověření platnosti.", rightX - 6, 95, 124, {
    fontPair: regularFont,
    size: 7.2,
    lineHeight: 9,
    color: colors.muted,
    align: "center",
  });

  drawWrappedText(page, buildVoucherPdfTerms(voucher).join(" "), leftX, 90, 320, {
    fontPair: regularFont,
    size: 7.9,
    lineHeight: 10.2,
    color: colors.muted,
    maxLines: 3,
  });

  const contactLines = buildVoucherPdfContactLines(settings);
  contactLines.forEach((line, index) => {
    drawWrappedText(page, line, rightX - 90, 58 - index * 12, 210, {
      fontPair: regularFont,
      size: 7.8,
      lineHeight: 10,
      color: colors.muted,
      align: "right",
    });
  });

  return pdf.save();
}

function isPdfEmbeddableImage(mimeType: string) {
  return mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/jpg";
}

async function embedLogoImage(pdf: PDFDocument, logo: Extract<VoucherPdfLogo, { kind: "image" }>) {
  if (logo.mimeType === "image/png") {
    return pdf.embedPng(logo.bytes);
  }

  return pdf.embedJpg(logo.bytes);
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

function formatSiteUrlForPdf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function resolveVoucherPublicDomain() {
  const explicitDomain = sanitizePublicDomain(env.VOUCHER_PUBLIC_DOMAIN) ?? sanitizePublicDomain(env.NEXT_PUBLIC_SITE_DOMAIN);

  if (explicitDomain) {
    return explicitDomain;
  }

  const appDomain = sanitizePublicDomain(formatSiteUrlForPdf(siteConfig.url));
  return appDomain ?? "";
}

function sanitizePublicDomain(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

  if (!withoutProtocol || withoutProtocol === "localhost") {
    return null;
  }

  if (withoutProtocol.includes(":")) {
    return null;
  }

  if (isPrivateIpv4(withoutProtocol) || withoutProtocol === "::1") {
    return null;
  }

  return withoutProtocol;
}

function isPrivateIpv4(hostname: string) {
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);

  if (!ipv4Match) {
    return false;
  }

  const [a, b, c, d] = ipv4Match.slice(1).map((part) => Number(part));

  if ([a, b, c, d].some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  if (a === 10 || a === 127) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  return false;
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
