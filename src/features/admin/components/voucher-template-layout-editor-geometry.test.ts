import assert from "node:assert/strict";
import test from "node:test";

import { defaultVoucherTemplateLayout } from "@/features/vouchers/lib/voucher-template-defaults";
import { fitVoucherTextToArea, getVoucherTextBaselineRangeMm, voucherTextLineStackFits } from "@/features/vouchers/lib/voucher-text-fit";
import { getVoucherQrRenderGeometry, getVoucherTextBaselineBrowserTopMm, pdfBottomToBrowserTop, voucherTemplateLayoutSchema } from "@/features/vouchers/lib/voucher-template-layout";
import { centerAreaAtPreviewPoint, centerAreaInTrim, constrainAreaToTrim, constrainBaselineToArea, getBaselineWithPreservedTopOffset, getLockedResizeSize, getResizeAnchor, internalToUiPosition, nudgeAreaInTrim, snapToHalfMm, uiToInternalPosition, updateAreaFromUi } from "./voucher-template-layout-editor-geometry";

const area = { xMm: 20, yMm: 15, widthMm: 30, heightMm: 10 };

test("editor nesmí ponechat baseline na hranách, kde glyph box VALUE přetéká", () => {
  const valueArea = defaultVoucherTemplateLayout.valueArea;
  for (const baselineMm of [valueArea.yMm, valueArea.yMm + valueArea.heightMm]) {
    const constrained = constrainBaselineToArea(valueArea, baselineMm);
    const candidate = { ...valueArea, baselineMm: constrained };
    assert.equal(voucherTemplateLayoutSchema.safeParse({ ...defaultVoucherTemplateLayout, valueArea: candidate }).success, true);
    const fit = fitVoucherTextToArea("1 500 Kč", candidate, (text, size) => text.length * size * 0.12);
    assert.equal(fit.overflowed, false, `baseline ${baselineMm} musí respektovat ascent/descent`);
  }
});

test("UI počátek je levý horní roh ořezu, včetně 3mm offsetu a výšky oblasti", () => {
  assert.deepEqual(internalToUiPosition({ xMm: 3, yMm: 92, heightMm: 10 }), { xMm: 0, yMm: 0 });
  assert.deepEqual(uiToInternalPosition({ xMm: 0, yMm: 0 }, 10), { xMm: 3, yMm: 92 });
  assert.deepEqual(uiToInternalPosition({ xMm: 24.5, yMm: 18 }, 10), { xMm: 27.5, yMm: 74 });
  assert.deepEqual(internalToUiPosition({ xMm: 27.5, yMm: 74, heightMm: 10 }), { xMm: 24.5, yMm: 18 });
  assert.deepEqual(internalToUiPosition({ xMm: 183, yMm: 3, heightMm: 10 }), { xMm: 180, yMm: 89 });
});

test("převod neomezuje přesnost interních souřadnic ani nemění uložený layout a PDF geometrii", () => {
  const before = structuredClone(defaultVoucherTemplateLayout);
  for (const key of ["valueArea", "serviceArea", "validityArea", "codeArea", "qrArea"] as const) {
    const stored = defaultVoucherTemplateLayout[key];
    const ui = internalToUiPosition(stored);
    const internal = uiToInternalPosition(ui, stored.heightMm);
    assert.ok(Math.abs(internal.xMm - stored.xMm) < 1e-10);
    assert.ok(Math.abs(internal.yMm - stored.yMm) < 1e-10);
    assert.ok(Math.abs(ui.yMm + 3 - pdfBottomToBrowserTop(stored.yMm, stored.heightMm)) < 1e-10);
  }
  const precise = { xMm: 12.345, yMm: 20.678, heightMm: 8.125 };
  const restored = uiToInternalPosition(internalToUiPosition(precise), precise.heightMm);
  assert.ok(Math.abs(restored.yMm - precise.yMm) < 1e-10);
  assert.deepEqual(defaultVoucherTemplateLayout, before);
  assert.equal(getVoucherTextBaselineBrowserTopMm(defaultVoucherTemplateLayout.valueArea), 63);
  assert.deepEqual(getVoucherQrRenderGeometry(defaultVoucherTemplateLayout.qrArea, 33), getVoucherQrRenderGeometry(before.qrArea, 33));
});

test("ruční X/Y přijme desetiny bez půlmilimetrového snapu a srovná překročené hranice", () => {
  const x = updateAreaFromUi(area, "xMm", 12.3, 0.5, false);
  assert.equal(x.xMm, 15.3);
  assert.equal(x.yMm, area.yMm);
  const y = updateAreaFromUi(x, "yMm", 18.1, 0.5, false);
  assert.ok(Math.abs(internalToUiPosition(y).yMm - 18.1) < 1e-10);
  assert.equal(updateAreaFromUi(area, "xMm", -5, 0.5, false).xMm, 3);
  assert.equal(updateAreaFromUi(area, "xMm", 999, 0.5, false).xMm, 183);
  assert.equal(updateAreaFromUi(area, "yMm", -5, 0.5, false).yMm, 92);
  assert.equal(updateAreaFromUi(area, "yMm", 999, 0.5, false).yMm, 3);
});

test("ruční rozměry zachovají horní hranu a QR čtverec, minimum a trim", () => {
  const resized = updateAreaFromUi(area, "heightMm", 12.3, 0.5, false);
  assert.equal(resized.heightMm, 12.3);
  assert.deepEqual(internalToUiPosition(resized), internalToUiPosition(area));
  assert.equal(getBaselineWithPreservedTopOffset({ ...area, baselineMm: 23, typography: { minFontSizePt: 4 } }, resized.yMm, resized.heightMm), 23);
  assert.equal(updateAreaFromUi(area, "widthMm", 0, 0.5, false).widthMm, 0.5);
  for (const field of ["widthMm", "heightMm"] as const) {
    const qr = updateAreaFromUi(defaultVoucherTemplateLayout.qrArea, field, 24.3, 20, true);
    assert.equal(qr.widthMm, 24.3);
    assert.equal(qr.heightMm, 24.3);
    const original = defaultVoucherTemplateLayout.qrArea;
    assert.equal(qr.xMm + qr.widthMm / 2, original.xMm + original.widthMm / 2);
    assert.equal(qr.yMm + qr.heightMm / 2, original.yMm + original.heightMm / 2);
    assert.equal(updateAreaFromUi(qr, field, 5, 20, true).widthMm, 20);
    assert.equal(updateAreaFromUi(qr, field, 999, 20, true).widthMm, 99);
    assert.equal(voucherTemplateLayoutSchema.safeParse({ ...defaultVoucherTemplateLayout, qrArea: qr }).success, true);
  }
});

test("vystředění vůči trimu zachová druhou osu a desetinné rozměry", () => {
  assert.deepEqual(centerAreaInTrim(area, "horizontal"), { ...area, xMm: 93 });
  assert.deepEqual(centerAreaInTrim(area, "vertical"), { ...area, yMm: 47.5 });
  assert.equal(centerAreaInTrim({ ...area, widthMm: 24.5 }, "horizontal").xMm, 95.75);
  assert.equal(centerAreaInTrim({ ...area, heightMm: 12.3 }, "vertical").yMm, 46.35);
});

test("šipky posunují po 0,1 mm, Shift po 1 mm bez kumulace chyby a respektují trim", () => {
  assert.deepEqual(nudgeAreaInTrim(area, "ArrowRight"), { ...area, xMm: 20.1 });
  assert.deepEqual(nudgeAreaInTrim(area, "ArrowLeft"), { ...area, xMm: 19.9 });
  assert.deepEqual(nudgeAreaInTrim(area, "ArrowUp"), { ...area, yMm: 15.1 });
  assert.deepEqual(nudgeAreaInTrim(area, "ArrowDown", true), { ...area, yMm: 14 });
  assert.deepEqual(nudgeAreaInTrim(area, "ArrowRight", true), { ...area, xMm: 21 });
  assert.equal(nudgeAreaInTrim(area, "Enter"), null);
  let moved = area;
  for (let index = 0; index < 10; index++) moved = nudgeAreaInTrim(moved, "ArrowRight")!;
  assert.equal(moved.xMm, 21);
  const edges = { ...area, xMm: 3, yMm: 3 };
  assert.deepEqual(nudgeAreaInTrim(edges, "ArrowLeft"), edges);
  assert.deepEqual(nudgeAreaInTrim(edges, "ArrowDown", true), edges);
  const opposite = { ...area, xMm: 183, yMm: 92 };
  assert.deepEqual(nudgeAreaInTrim(opposite, "ArrowRight", true), opposite);
  assert.deepEqual(nudgeAreaInTrim(opposite, "ArrowUp"), opposite);
  assert.equal(nudgeAreaInTrim({ ...area, xMm: 182.95 }, "ArrowRight")!.xMm, 183);
});

test("resize rohy zachovají protilehlý roh", () => {
  assert.deepEqual(getResizeAnchor(area, "bottomRight", 35, 12), { xMm: 20, yMm: 13 });
  assert.deepEqual(getResizeAnchor(area, "bottomLeft", 35, 12), { xMm: 15, yMm: 13 });
  assert.deepEqual(getResizeAnchor(area, "topRight", 35, 12), { xMm: 20, yMm: 15 });
  assert.deepEqual(getResizeAnchor(area, "topLeft", 35, 12), { xMm: 15, yMm: 15 });
});

test("locked resize zachová čtvercový poměr a snap 0,5 mm", () => {
  assert.equal(snapToHalfMm(20.24), 20);
  assert.equal(getLockedResizeSize(28.24, 27.91, 5), 28);
  assert.equal(getLockedResizeSize(3.1, 3.4, 5), 5);
});

test("textová baseline se při přesunu oblasti posune spolu s ní", () => {
  const textArea = { yMm: 30.5, heightMm: 11.5, baselineMm: 37, typography: { minFontSizePt: 8 } };

  assert.equal(getBaselineWithPreservedTopOffset(textArea, 55, textArea.heightMm), 61.5);
});

test("textová baseline při změně výšky zachová odstup od horní hrany", () => {
  const textArea = { yMm: 30.5, heightMm: 11.5, baselineMm: 37, typography: { minFontSizePt: 8 } };

  assert.equal(getBaselineWithPreservedTopOffset(textArea, textArea.yMm, 20), 45.5);
});

test("resize clampne baseline na nejbližší bezpečnou hranici bez změny fontu", () => {
  const textArea = { yMm: 30.5, heightMm: 10, baselineMm: 32, typography: { minFontSizePt: 8 } };
  const resized = { ...textArea, heightMm: 4 };
  const range = getVoucherTextBaselineRangeMm(resized, 8);
  assert.equal(getBaselineWithPreservedTopOffset(textArea, textArea.yMm, 4), range.minBaselineMm);
  assert.equal(constrainBaselineToArea(resized, 40), range.maxBaselineMm);
  assert.equal(voucherTextLineStackFits({ ...resized, baselineMm: range.minBaselineMm }, 1, 0, 8), true);
  assert.equal(voucherTextLineStackFits({ ...resized, baselineMm: range.maxBaselineMm }, 1, 0, 8), true);
  assert.equal(textArea.typography.minFontSizePt, 8);
});

test("platné baseline všech výchozích oblastí zůstanou přesně zachované", () => {
  for (const key of ["valueArea", "serviceArea", "validityArea", "codeArea"] as const) {
    const stored = defaultVoucherTemplateLayout[key];
    assert.equal(constrainBaselineToArea(stored, stored.baselineMm), stored.baselineMm);
  }
});

test("příliš nízká oblast nemá bezpečný rozsah a clamp nezmění font ani výšku", () => {
  const small = { ...defaultVoucherTemplateLayout.valueArea, heightMm: 0.5 };
  const range = getVoucherTextBaselineRangeMm(small, small.typography.minFontSizePt);
  assert.ok(range.minBaselineMm > range.maxBaselineMm);
  assert.equal(constrainBaselineToArea(small, small.baselineMm), small.yMm + small.heightMm);
  assert.equal(small.typography.minFontSizePt, 16.5);
  assert.equal(small.heightMm, 0.5);
});


test("tažení drží všechny hrany oblasti uvnitř ořezu", () => {
  assert.deepEqual(constrainAreaToTrim({ ...area, xMm: -5, yMm: 0 }), { ...area, xMm: 3, yMm: 3 });
  assert.deepEqual(constrainAreaToTrim({ ...area, xMm: 210, yMm: 100 }), { ...area, xMm: 183, yMm: 92 });
  assert.deepEqual(constrainAreaToTrim(area), area);
});

test("resize nepřesáhne rozměry ořezové oblasti", () => {
  assert.deepEqual(constrainAreaToTrim({ xMm: 0, yMm: 0, widthMm: 216, heightMm: 105 }), { xMm: 3, yMm: 3, widthMm: 210, heightMm: 99 });
  const qr = constrainAreaToTrim({ xMm: 170, yMm: 80, widthMm: 99, heightMm: 99 });
  assert.equal(qr.widthMm, qr.heightMm);
  assert.equal(qr.xMm + qr.widthMm, 213);
  assert.equal(qr.yMm + qr.heightMm, 102);
});

test("umístění středu v náhledu zachová rozměry a omezí QR na ořez", () => {
  const qr = { xMm: 150, yMm: 20, widthMm: 24, heightMm: 24 };
  const centered = centerAreaAtPreviewPoint(qr, 180.25, 65.75);
  assert.equal(centered.xMm + centered.widthMm / 2, 180.25);
  assert.equal(pdfBottomToBrowserTop(centered.yMm, centered.heightMm) + centered.heightMm / 2, 65.75);
  assert.equal(centered.widthMm, 24);
  assert.equal(centered.heightMm, 24);
  assert.deepEqual(centerAreaAtPreviewPoint(qr, 0, 0), { ...qr, xMm: 3, yMm: 78 });
  assert.deepEqual(centerAreaAtPreviewPoint(qr, 216, 105), { ...qr, xMm: 189, yMm: 3 });
  const resized = updateAreaFromUi({ ...qr, xMm: 3, yMm: 3 }, "widthMm", 30, 20, true);
  assert.deepEqual(resized, { xMm: 3, yMm: 3, widthMm: 30, heightMm: 30 });
});
