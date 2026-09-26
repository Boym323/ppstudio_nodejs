import type { VoucherTemplateLayoutV1 } from "./voucher-template-layout";

const baseTypography = {
  fontFamilyKey: "noto-sans",
  preferredFontSizePt: 11,
  minFontSizePt: 7,
  lineHeightMm: 4,
  fontWeight: "regular" as const,
  alignment: "left" as const,
  color: { c: 0, m: 0, y: 0, k: 1 },
};

export const defaultVoucherTemplateLayout: VoucherTemplateLayoutV1 = {
  printPage: { widthMm: 216, heightMm: 105 },
  trim: { xMm: 3, yMm: 3, widthMm: 210, heightMm: 99 },
  valueArea: {
    xMm: 18,
    yMm: 39,
    widthMm: 130,
    heightMm: 10,
    baselineMm: 42,
    maxLines: 1,
    typography: { ...baseTypography, preferredFontSizePt: 16.5, minFontSizePt: 16.5, lineHeightMm: 0, fontWeight: "bold", alignment: "center" },
  },
  serviceArea: {
    xMm: 18,
    yMm: 39,
    widthMm: 130,
    heightMm: 11,
    baselineMm: 41.2,
    maxLines: 2,
    typography: { ...baseTypography, preferredFontSizePt: 14.5, minFontSizePt: 8.5, lineHeightMm: 0, fontWeight: "bold", alignment: "center" },
  },
  validityArea: {
    xMm: 18,
    yMm: 16,
    widthMm: 52.5,
    heightMm: 8,
    baselineMm: 18.35,
    maxLines: 1,
    typography: { ...baseTypography, preferredFontSizePt: 7.5, minFontSizePt: 5.8, alignment: "center" },
  },
  codeArea: {
    xMm: 81,
    yMm: 16,
    widthMm: 67,
    heightMm: 8,
    baselineMm: 18.35,
    maxLines: 1,
    typography: { ...baseTypography, preferredFontSizePt: 7.4, minFontSizePt: 5.8, fontWeight: "bold", alignment: "center" },
  },
  qrArea: { xMm: 173.7, yMm: 20, widthMm: 28, heightMm: 28 },
};
