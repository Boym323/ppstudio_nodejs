import assert from "node:assert/strict";
import test from "node:test";

import { fitVoucherTextToArea, getVoucherTextLineHeightMm, getVoucherTextMinimumLineHeightMm } from "./voucher-text-fit";

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

test("víceřádkový SERVICE fitting drží bezpečnou výšku pro auto i explicitní řádkování", () => {
  const area = { yMm: 10, widthMm: 20, heightMm: 25, baselineMm: 13, maxLines: 3, typography: { preferredFontSizePt: 10, minFontSizePt: 10, lineHeightMm: 0 } };
  for (const lineHeightMm of [0, 5, 0.1]) {
    const fit = fitVoucherTextToArea("Jedna dvě tři čtyři pět šest", { ...area, typography: { ...area.typography, lineHeightMm } }, measure);
    assert.ok(fit.lines.length > 1);
    assert.equal(fit.overflowed, false);
    assert.ok(fit.lineHeightMm >= getVoucherTextMinimumLineHeightMm(fit.fontSizePt));
  }
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

test("historický VALUE fallback zachová celou částku bez ellipsis", () => {
  const amount = "100 000 Kč";
  const fit = fitVoucherTextToArea(amount, {
    yMm: 10,
    widthMm: 10,
    heightMm: 8,
    baselineMm: 13,
    maxLines: 1,
    typography: { preferredFontSizePt: 18, minFontSizePt: 10, lineHeightMm: 0 },
  }, measure, 1, { minimumFontSizePt: 0.1, ellipsisOnOverflow: false });

  assert.equal(fit.overflowed, false);
  assert.equal(fit.lines.join(""), amount);
  assert.ok(fit.fontSizePt < 10);
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

test("fitting zohlední ascent a descent kolem baseline i pro jeden řádek", () => {
  const baseArea = {
    yMm: 10,
    widthMm: 40,
    heightMm: 10,
    maxLines: 1,
    typography: { preferredFontSizePt: 10, minFontSizePt: 10, lineHeightMm: 4 },
  };

  const atTop = fitVoucherTextToArea("Text", { ...baseArea, baselineMm: 20 }, measure, 1);
  const atBottom = fitVoucherTextToArea("Text", { ...baseArea, baselineMm: 10 }, measure, 1);
  const centered = fitVoucherTextToArea("Text", { ...baseArea, baselineMm: 14 }, measure, 1);

  assert.equal(atTop.overflowed, true);
  assert.equal(atBottom.overflowed, true);
  assert.equal(centered.overflowed, false);
});
