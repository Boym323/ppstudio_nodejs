import type { VoucherTemplateTextAreaKey } from "@/features/vouchers/lib/voucher-template-layout";

/**
 * UI-only fixture data for the layout editor. It must never be added to the
 * persisted voucher template layout or to the voucher PDF renderer input.
 */
export const VOUCHER_TEMPLATE_PREVIEW_VALUES = {
  valueArea: "1 500 Kč",
  serviceArea: {
    normal: "Korejský lash lifting",
    long: "ANTI AGE TREATMENT S INTENZIVNÍ MASÁŽÍ",
  },
  validityArea: "31. 12. 2027",
  codeArea: "PP-2026-ABC123",
} as const;

export type ServicePreviewScenario = keyof typeof VOUCHER_TEMPLATE_PREVIEW_VALUES.serviceArea;

export type VoucherTemplatePreviewMode = "VALUE" | "SERVICE" | "STOCK";

export type VoucherTemplatePreviewAreaKey = VoucherTemplateTextAreaKey | "qrArea";

export type PreviewTypography = {
  fontFamilyKey: string;
  preferredFontSizePt: number;
  minFontSizePt: number;
  lineHeightMm: number;
  fontWeight: "regular" | "bold";
  alignment: "left" | "center";
};

export type VoucherTemplatePreviewArea = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  baselineMm: number;
  maxLines: number;
  typography: PreviewTypography;
};

export type VoucherTemplatePreviewFit = {
  fontSizePt: number;
  lines: string[];
  overflowed: boolean;
  lineHeightMm: number;
};

export type VoucherTemplatePreviewTextMetrics = {
  widthMm: number;
};

export type VoucherTemplatePreviewTextMeasurer = (
  text: string,
  fontSizePt: number,
  typography: Pick<PreviewTypography, "fontFamilyKey" | "fontWeight">,
) => VoucherTemplatePreviewTextMetrics | null;

const PT_TO_MM = 25.4 / 72;
const FIT_STEP_PT = 0.25;
export const VOUCHER_TEMPLATE_PREVIEW_HORIZONTAL_PADDING_MM = 1;
const PREVIEW_HORIZONTAL_PADDING_MM = VOUCHER_TEMPLATE_PREVIEW_HORIZONTAL_PADDING_MM * 2;

export const VOUCHER_TEMPLATE_PREVIEW_FONT_FAMILIES: Readonly<Record<string, string>> = {
  "noto-sans": '"Noto Sans", sans-serif',
};

export function isVoucherTemplatePreviewAreaVisible(areaKey: VoucherTemplatePreviewAreaKey, previewMode: VoucherTemplatePreviewMode) {
  if (areaKey === "qrArea" || areaKey === "codeArea") return true;
  if (previewMode === "VALUE") return areaKey === "valueArea" || areaKey === "validityArea";
  if (previewMode === "SERVICE") return areaKey === "serviceArea" || areaKey === "validityArea";
  return false;
}

export function getVoucherTemplatePreviewText(areaKey: VoucherTemplateTextAreaKey, serviceScenario: ServicePreviewScenario): string;
export function getVoucherTemplatePreviewText(areaKey: "qrArea", serviceScenario: ServicePreviewScenario): null;
export function getVoucherTemplatePreviewText(
  areaKey: VoucherTemplateTextAreaKey | "qrArea",
  serviceScenario: ServicePreviewScenario,
): string | null {
  if (areaKey === "valueArea") return VOUCHER_TEMPLATE_PREVIEW_VALUES.valueArea;
  if (areaKey === "serviceArea") return VOUCHER_TEMPLATE_PREVIEW_VALUES.serviceArea[serviceScenario];
  if (areaKey === "validityArea") return VOUCHER_TEMPLATE_PREVIEW_VALUES.validityArea;
  if (areaKey === "codeArea") return VOUCHER_TEMPLATE_PREVIEW_VALUES.codeArea;
  return null;
}

/**
 * Browser-safe approximation of the PDF renderer's fitText helper. It is
 * intentionally kept in the admin UI layer because the PDF implementation
 * relies on server-only font and filesystem APIs.
 */
export function fitVoucherTemplatePreviewText(text: string, area: VoucherTemplatePreviewArea, textMeasurer?: VoucherTemplatePreviewTextMeasurer | null): VoucherTemplatePreviewFit {
  const maxWidthMm = Math.max(1, area.widthMm - PREVIEW_HORIZONTAL_PADDING_MM);

  for (let size = area.typography.preferredFontSizePt; size >= area.typography.minFontSizePt - 0.001; size = roundSize(size - FIT_STEP_PT)) {
    const fontSizePt = roundSize(size);
    const lines = wrapPreviewText(text, fontSizePt, maxWidthMm, area.typography, textMeasurer);
    const lineHeightMm = getPreviewLineHeightMm(area.typography.lineHeightMm, fontSizePt);

    if (lines.length <= area.maxLines && lines.every((line) => measurePreviewTextWidthMm(line, fontSizePt, area.typography, textMeasurer) <= maxWidthMm) && lines.length * lineHeightMm <= area.heightMm + 0.001) {
      return { fontSizePt, lines, overflowed: false, lineHeightMm };
    }

    if (fontSizePt === area.typography.minFontSizePt) break;
  }

  const fontSizePt = area.typography.minFontSizePt;
  const lineHeightMm = getPreviewLineHeightMm(area.typography.lineHeightMm, fontSizePt);
  const lines = wrapPreviewText(text, fontSizePt, maxWidthMm, area.typography, textMeasurer).slice(0, area.maxLines);
  const lastLineIndex = lines.length - 1;

  if (lastLineIndex >= 0) {
    lines[lastLineIndex] = addPreviewEllipsis(lines[lastLineIndex], fontSizePt, maxWidthMm, area.typography, textMeasurer);
  }

  return { fontSizePt, lines, overflowed: true, lineHeightMm };
}

export function createVoucherTemplatePreviewTextMeasurer(scale = 1): VoucherTemplatePreviewTextMeasurer | null {
  if (typeof document === "undefined" || typeof document.createElement !== "function") return null;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  return (text, fontSizePt, typography) => {
    const fontFamily = VOUCHER_TEMPLATE_PREVIEW_FONT_FAMILIES[typography.fontFamilyKey] ?? '"Noto Sans", sans-serif';
    const fontSizePx = getVoucherTemplatePreviewFontSizePx(fontSizePt, scale);
    const font = `${typography.fontWeight === "bold" ? 700 : 400} ${fontSizePx}px ${fontFamily}`;

    if (document.fonts && !document.fonts.check(font)) return null;

    context.font = font;
    const metrics = context.measureText(text);

    return { widthMm: metrics.width / scale };
  };
}

export function getVoucherTemplatePreviewFontSizePx(fontSizePt: number, scale = 1) {
  return fontSizePt * PT_TO_MM * scale;
}

export function getVoucherTemplatePreviewBaselineTopMm(area: Pick<VoucherTemplatePreviewArea, "yMm" | "heightMm" | "baselineMm">) {
  return area.heightMm - (area.baselineMm - area.yMm);
}

export function getVoucherTemplatePreviewBaselineTopPx(
  area: Pick<VoucherTemplatePreviewArea, "yMm" | "heightMm" | "baselineMm">,
  scale = 1,
) {
  return getVoucherTemplatePreviewBaselineTopMm(area) * scale;
}

export function getVoucherTemplatePreviewLineBaselineTopPx(
  area: Pick<VoucherTemplatePreviewArea, "yMm" | "heightMm" | "baselineMm">,
  lineCount: number,
  lineIndex: number,
  lineHeightMm: number,
  scale = 1,
) {
  return getVoucherTemplatePreviewLineBaselinePx(getVoucherTemplatePreviewBaselineTopPx(area, scale), lineCount, lineIndex, lineHeightMm, scale);
}

export function getVoucherTemplatePreviewLineBaselinePx(baselinePx: number, lineCount: number, lineIndex: number, lineHeightMm: number, scale = 1) {
  const lineHeightPx = lineHeightMm * scale;
  return baselinePx - Math.max(0, lineCount - 1 - lineIndex) * lineHeightPx;
}

function getPreviewLineHeightMm(lineHeightMm: number, fontSizePt: number) {
  return lineHeightMm > 0 ? lineHeightMm : fontSizePt * PT_TO_MM * 1.2;
}

function wrapPreviewText(text: string, fontSizePt: number, maxWidthMm: number, typography: PreviewTypography, textMeasurer?: VoucherTemplatePreviewTextMeasurer | null) {
  const lines: string[] = [];

  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (!currentLine && measurePreviewTextWidthMm(word, fontSizePt, typography, textMeasurer) > maxWidthMm) {
        const chunks = splitPreviewWord(word, fontSizePt, maxWidthMm, typography, textMeasurer);
        lines.push(...chunks.slice(0, -1));
        currentLine = chunks.at(-1) ?? "";
      } else if (!currentLine || measurePreviewTextWidthMm(candidate, fontSizePt, typography, textMeasurer) <= maxWidthMm) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
  }

  return lines;
}

function splitPreviewWord(word: string, fontSizePt: number, maxWidthMm: number, typography: PreviewTypography, textMeasurer?: VoucherTemplatePreviewTextMeasurer | null) {
  const chunks: string[] = [];
  let current = "";

  for (const character of Array.from(word)) {
    const candidate = `${current}${character}`;

    if (current && measurePreviewTextWidthMm(candidate, fontSizePt, typography, textMeasurer) > maxWidthMm) {
      chunks.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function addPreviewEllipsis(text: string, fontSizePt: number, maxWidthMm: number, typography: PreviewTypography, textMeasurer?: VoucherTemplatePreviewTextMeasurer | null) {
  const ellipsis = "…";
  const characters = Array.from(text.trimEnd());

  for (let length = characters.length; length >= 0; length -= 1) {
    const candidate = `${characters.slice(0, length).join("").trimEnd()}${ellipsis}`;
    if (measurePreviewTextWidthMm(candidate, fontSizePt, typography, textMeasurer) <= maxWidthMm) return candidate;
  }

  return ellipsis;
}

function measurePreviewTextWidthMm(text: string, fontSizePt: number, typography: PreviewTypography, textMeasurer?: VoucherTemplatePreviewTextMeasurer | null) {
  const measured = textMeasurer?.(text, fontSizePt, typography);
  if (measured) return measured.widthMm;

  const weightFactor = typography.fontWeight === "bold" ? 1.04 : 1;
  const widthInEm = Array.from(text).reduce((total, character) => total + getCharacterWidthInEm(character), 0);
  return widthInEm * fontSizePt * PT_TO_MM * weightFactor;
}

function getCharacterWidthInEm(character: string) {
  if (/\s/.test(character)) return 0.32;
  if (/[ilI1|.,:;!'`´]/.test(character)) return 0.28;
  if (/[MW@%#&]/.test(character)) return 0.88;
  if (/[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(character)) return 0.68;
  if (/[-–—/()[\]{}]/.test(character)) return 0.38;
  return 0.56;
}

function roundSize(value: number) {
  return Number(value.toFixed(2));
}
