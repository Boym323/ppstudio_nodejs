import assert from "node:assert/strict";
import test from "node:test";

import { fitVoucherTextToArea, getVoucherTextLineHeightMm } from "./voucher-text-fit";

const measure = (text: string, fontSizePt: number) => text.length * fontSizePt * 0.12;

test("automatické řádkování při lineHeightMm=0 nikdy neskládá řádky přes sebe", () => {
  const lineHeightMm = getVoucherTextLineHeightMm(0, 10);
  assert.ok(lineHeightMm > 0);

  const fit = fitVoucherTextToArea(
    "Dlouhý název služby který se zalomí",
    {
      yMm: 10,
      widthMm: 28,
      heightMm: 20,
      baselineMm: 14,
      maxLines: 3,
      typography: { preferredFontSizePt: 10, minFontSizePt: 8, lineHeightMm: 0 },
    },
    measure,
    1,
  );

  assert.ok(fit.lineHeightMm > 0);
  assert.ok(fit.lines.length * fit.lineHeightMm <= 20 + 0.001 || fit.overflowed);
});

test("fitting respektuje výšku oblasti a označí overflow při příliš malé výšce", () => {
  const fit = fitVoucherTextToArea(
    "Jedna dvě tři čtyři pět šest",
    {
      yMm: 10,
      widthMm: 24,
      heightMm: 2,
      baselineMm: 11,
      maxLines: 4,
      typography: { preferredFontSizePt: 12, minFontSizePt: 8, lineHeightMm: 4 },
    },
    measure,
    1,
  );

  assert.equal(fit.overflowed, true);
  assert.equal(fit.lines.length, 1);
  assert.match(fit.lines[0] ?? "", /…$/);
});

test("horizontální inset se promítá do stejného maxWidth pro preview i PDF", () => {
  const fit = fitVoucherTextToArea(
    "PP-2026-ABC123",
    {
      yMm: 10,
      widthMm: 30,
      heightMm: 8,
      baselineMm: 12,
      maxLines: 1,
      typography: { preferredFontSizePt: 8, minFontSizePt: 6, lineHeightMm: 4 },
    },
    measure,
    2,
  );

  assert.equal(fit.maxWidthMm, 26);
});

test("více řádků respektuje prostor nad konkrétní baseline", () => {
  const fit = fitVoucherTextToArea(
    "Jedna dvě tři čtyři",
    {
      yMm: 10,
      widthMm: 20,
      heightMm: 10,
      baselineMm: 19,
      maxLines: 3,
      typography: { preferredFontSizePt: 10, minFontSizePt: 8, lineHeightMm: 4 },
    },
    measure,
    1,
  );

  assert.equal(fit.overflowed, true);
  assert.equal(fit.lines.length, 1);
});
