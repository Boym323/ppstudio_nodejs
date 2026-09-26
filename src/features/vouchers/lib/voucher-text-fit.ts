export type VoucherTextFitArea = {
  xMm?: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  baselineMm: number;
  maxLines: number;
  typography: {
    preferredFontSizePt: number;
    minFontSizePt: number;
    lineHeightMm: number;
  };
};

export type VoucherTextFitResult = {
  fontSizePt: number;
  lines: string[];
  overflowed: boolean;
  lineHeightMm: number;
  maxWidthMm: number;
};

export type VoucherTextWidthMeasurer = (text: string, fontSizePt: number) => number;
export type VoucherTextFitOptions = { minimumFontSizePt?: number; ellipsisOnOverflow?: boolean };

export const VOUCHER_TEXT_HORIZONTAL_INSET_MM = {
  valueArea: 1,
  serviceArea: 1,
  validityArea: 1,
  codeArea: 2,
} as const;

const PT_TO_MM = 25.4 / 72;
const FIT_STEP_PT = 0.25;
const VOUCHER_TEXT_ASCENT_EM = 1.07;
const VOUCHER_TEXT_DESCENT_EM = 0.3;

export function getVoucherTextLineHeightMm(configuredLineHeightMm: number, fontSizePt: number) {
  const minimum = getVoucherTextMinimumLineHeightMm(fontSizePt);
  return configuredLineHeightMm > 0 ? Math.max(configuredLineHeightMm, minimum) : minimum;
}

export function getVoucherTextMinimumLineHeightMm(fontSizePt: number) {
  return fontSizePt * PT_TO_MM * (VOUCHER_TEXT_ASCENT_EM + VOUCHER_TEXT_DESCENT_EM);
}

export function fitVoucherTextToArea(
  text: string,
  area: VoucherTextFitArea,
  measureTextWidthMm: VoucherTextWidthMeasurer,
  horizontalInsetMm = 1,
  options: VoucherTextFitOptions = {},
): VoucherTextFitResult {
  const maxWidthMm = Math.max(1, area.widthMm - horizontalInsetMm * 2);
  const maxLines = Math.max(1, Math.floor(area.maxLines));
  const minimumFontSizePt = Math.max(0.1, options.minimumFontSizePt ?? area.typography.minFontSizePt);
  const preferredFontSizePt = Math.max(minimumFontSizePt, area.typography.preferredFontSizePt);

  let size = preferredFontSizePt;
  while (size >= minimumFontSizePt - 0.001) {
    const fontSizePt = roundSize(size);
    const lines = wrapVoucherText(text, fontSizePt, maxWidthMm, measureTextWidthMm);
    const lineHeightMm = getVoucherTextLineHeightMm(area.typography.lineHeightMm, fontSizePt);

    if (
      lines.length <= maxLines
      && lines.every((line) => measureTextWidthMm(line, fontSizePt) <= maxWidthMm + 0.001)
      && voucherTextLineStackFits(area, lines.length, lineHeightMm, fontSizePt)
    ) {
      return { fontSizePt, lines, overflowed: false, lineHeightMm, maxWidthMm };
    }

    if (fontSizePt <= minimumFontSizePt + 0.001) break;
    size = Math.max(minimumFontSizePt, roundSize(fontSizePt - FIT_STEP_PT));
  }

  const fontSizePt = minimumFontSizePt;
  const lineHeightMm = getVoucherTextLineHeightMm(area.typography.lineHeightMm, fontSizePt);
  const wrappedLines = wrapVoucherText(text, fontSizePt, maxWidthMm, measureTextWidthMm);
  let visibleLineLimit = Math.max(1, Math.min(maxLines, wrappedLines.length || 1));
  while (visibleLineLimit > 1 && !voucherTextLineStackFits(area, visibleLineLimit, lineHeightMm, fontSizePt)) {
    visibleLineLimit -= 1;
  }
  const lines = wrappedLines.slice(0, visibleLineLimit);
  const lastLineIndex = lines.length - 1;

  if (lastLineIndex >= 0 && options.ellipsisOnOverflow !== false) {
    lines[lastLineIndex] = addVoucherEllipsis(lines[lastLineIndex], fontSizePt, maxWidthMm, measureTextWidthMm);
  }

  return { fontSizePt, lines, overflowed: true, lineHeightMm, maxWidthMm };
}

export function voucherTextLineStackFits(
  area: Pick<VoucherTextFitArea, "yMm" | "heightMm" | "baselineMm">,
  lineCount: number,
  lineHeightMm: number,
  fontSizePt: number,
) {
  if (lineCount <= 0) return true;

  const fontSizeMm = fontSizePt * PT_TO_MM;
  const bottom = area.baselineMm - fontSizeMm * VOUCHER_TEXT_DESCENT_EM;
  const topBaseline = area.baselineMm + Math.max(0, lineCount - 1) * lineHeightMm;
  const top = topBaseline + fontSizeMm * VOUCHER_TEXT_ASCENT_EM;

  return bottom >= area.yMm - 0.001 && top <= area.yMm + area.heightMm + 0.001;
}

function wrapVoucherText(text: string, fontSizePt: number, maxWidthMm: number, measureTextWidthMm: VoucherTextWidthMeasurer) {
  const lines: string[] = [];

  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (!currentLine && measureTextWidthMm(word, fontSizePt) > maxWidthMm) {
        const chunks = splitVoucherWord(word, fontSizePt, maxWidthMm, measureTextWidthMm);
        lines.push(...chunks.slice(0, -1));
        currentLine = chunks.at(-1) ?? "";
      } else if (!currentLine || measureTextWidthMm(candidate, fontSizePt) <= maxWidthMm) {
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

function splitVoucherWord(word: string, fontSizePt: number, maxWidthMm: number, measureTextWidthMm: VoucherTextWidthMeasurer) {
  const chunks: string[] = [];
  let current = "";

  for (const character of Array.from(word)) {
    const candidate = `${current}${character}`;

    if (current && measureTextWidthMm(candidate, fontSizePt) > maxWidthMm) {
      chunks.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function addVoucherEllipsis(text: string, fontSizePt: number, maxWidthMm: number, measureTextWidthMm: VoucherTextWidthMeasurer) {
  const ellipsis = "…";
  const characters = Array.from(text.trimEnd());

  for (let length = characters.length; length >= 0; length -= 1) {
    const candidate = `${characters.slice(0, length).join("").trimEnd()}${ellipsis}`;
    if (measureTextWidthMm(candidate, fontSizePt) <= maxWidthMm) return candidate;
  }

  return ellipsis;
}

function roundSize(value: number) {
  return Number(value.toFixed(2));
}
