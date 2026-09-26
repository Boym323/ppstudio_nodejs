import type { VoucherTemplateTextAreaKey } from "@/features/vouchers/lib/voucher-template-layout";
import { fitVoucherTextToArea } from "@/features/vouchers/lib/voucher-text-fit";

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
export const VOUCHER_TEMPLATE_PREVIEW_HORIZONTAL_PADDING_MM = 1;

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
 * Browser preview wrapper over the same pure fitting rules used by the PDF renderer.
 * Only font measurement remains environment-specific.
 */
export function fitVoucherTemplatePreviewText(text: string, area: VoucherTemplatePreviewArea, textMeasurer?: VoucherTemplatePreviewTextMeasurer | null, horizontalInsetMm = VOUCHER_TEMPLATE_PREVIEW_HORIZONTAL_PADDING_MM): VoucherTemplatePreviewFit {
  const fit = fitVoucherTextToArea(
    text,
    area,
    (value, fontSizePt) => measurePreviewTextWidthMm(value, fontSizePt, area.typography, textMeasurer),
    horizontalInsetMm,
  );

  return {
    fontSizePt: fit.fontSizePt,
    lines: fit.lines,
    overflowed: fit.overflowed,
    lineHeightMm: fit.lineHeightMm,
  };
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

    // The editor only renders this measurer after document.fonts.ready. Do not
    // fall back merely because FontFaceSet.check() reports a transient miss:
    // fitting must use the same Canvas font metrics as PreviewCanvas.
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
