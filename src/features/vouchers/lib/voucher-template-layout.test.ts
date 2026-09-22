import assert from "node:assert/strict";
import test from "node:test";

import { browserTopToPdfBottom, pdfBottomToBrowserTop, voucherTemplateLayoutSchema } from "./voucher-template-layout";

test("transformace browser/PDF souřadnic je obousměrná", () => {
  const top = pdfBottomToBrowserTop(20, 28);
  assert.equal(top, 57);
  assert.equal(browserTopToPdfBottom(top, 28), 20);
});

test("layout odmítne deformovaný QR a CMYK mimo rozsah", () => {
  const base = { printPage: { widthMm: 216, heightMm: 105 }, trim: { xMm: 3, yMm: 3, widthMm: 210, heightMm: 99 } };
  const text = { xMm: 10, yMm: 10, widthMm: 30, heightMm: 10, baselineMm: 12, maxLines: 1, typography: { fontFamilyKey: "noto-sans", preferredFontSizePt: 10, minFontSizePt: 8, lineHeightMm: 4, fontWeight: "regular" as const, alignment: "left" as const, color: { c: 0, m: 0, y: 0, k: 1 } } };
  const invalid = { ...base, valueArea: text, serviceArea: text, validityArea: text, codeArea: { ...text, typography: { ...text.typography, color: { ...text.typography.color, c: 2 } } }, qrArea: { xMm: 170, yMm: 20, widthMm: 28, heightMm: 20 } };
  assert.equal(voucherTemplateLayoutSchema.safeParse(invalid).success, false);
});
