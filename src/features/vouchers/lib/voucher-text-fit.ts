export type VoucherTextFitArea = {
  widthMm: number;
  heightMm: number;
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

export const VOUCHER_TEXT_HORIZONTAL_INSET_MM = {
  valueArea: 1,
  serviceArea: 1,
  validityArea: 1,
  codeArea: 2,
} as const;

const PT_TO_MM = 25.4 / 72;
const FIT_STEP_PT = 0.25;

export function getVoucherTextLineHeightMm(configuredLineHeightMm: number, fontSizePt: number) {
  return configuredLineHeightMm > 0 ? configuredLineHeightMm : fontSizePt * PT_TO_MM * 1.2;
}

export function fitVoucherTextToArea(
  text: string,
  area: VoucherTextFitArea,
  measureTextWidthMm: VoucherTextWidthMeasurer,
  horizontalInsetMm = 1,
): VoucherTextFitResult {
  const maxWidthMm = Math.max(1, area.widthMm - horizontalInsetMm * 2);
  const maxLines = Math.max(1, Math.floor(area.maxLines));
  const minimumFontSizePt = Math.max(0.1, area.typography.minFontSizePt);
  const preferredFontSizePt = Math.max(minimumFontSizePt, area.typography.preferredFontSizePt);

  for (let size = preferredFontSizePt; size >= minimumFontSizePt - 0.001; size = roundSize(size - FIT_STEP_PT)) {
    const fontSizePt = roundSize(size);
    const lines = wrapVoucherText(text, fontSizePt, maxWidthMm, measureTextWidthMm);
    const lineHeightMm = getVoucherTextLineHeightMm(area.typography.lineHeightMm, fontSizePt);

    if (
      lines.length <= maxLines
      && lines.every((line) => measureTextWidthMm(line, fontSizePt) <= maxWidthMm + 0.001)
      && lines.length * lineHeightMm <= area.heightMm + 0.001
    ) {
      return { fontSizePt, lines, overflowed: false, lineHeightMm, maxWidthMm };
    }

    if (fontSizePt === minimumFontSizePt) break;
  }

  const fontSizePt = minimumFontSizePt;
  const lineHeightMm = getVoucherTextLineHeightMm(area.typography.lineHeightMm, fontSizePt);
  const maxLinesByHeight = Math.max(1, Math.floor((area.heightMm + 0.001) / lineHeightMm));
  const visibleLineLimit = Math.max(1, Math.min(maxLines, maxLinesByHeight));
  const lines = wrapVoucherText(text, fontSizePt, maxWidthMm, measureTextWidthMm).slice(0, visibleLineLimit);
  const lastLineIndex = lines.length - 1;

  if (lastLineIndex >= 0) {
    lines[lastLineIndex] = addVoucherEllipsis(lines[lastLineIndex], fontSizePt, maxWidthMm, measureTextWidthMm);
  }

  return { fontSizePt, lines, overflowed: true, lineHeightMm, maxWidthMm };
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
