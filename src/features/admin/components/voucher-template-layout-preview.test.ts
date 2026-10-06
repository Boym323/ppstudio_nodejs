import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { defaultVoucherTemplateLayout } from "@/features/vouchers/lib/voucher-template-defaults";

import {
  getVoucherTemplatePreviewBaselineTopMm,
  getVoucherTemplatePreviewBaselineTopPx,
  getVoucherTemplatePreviewFontSizePx,
  getVoucherTemplatePreviewLineBaselinePx,
  fitVoucherTemplatePreviewText,
  createVoucherTemplatePreviewQr,
  getVoucherTemplatePreviewText,
  isVoucherTemplatePreviewAreaVisible,
  VOUCHER_TEMPLATE_PREVIEW_QR,
} from "./voucher-template-layout-preview";

test("VALUE preview používá UI fixture 1 500 Kč", () => {
  assert.equal(getVoucherTemplatePreviewText("valueArea", "normal"), "1 500 Kč");
});

test("SERVICE preview rozlišuje běžný a dlouhý scénář", () => {
  assert.equal(getVoucherTemplatePreviewText("serviceArea", "normal"), "Korejský lash lifting");
  assert.equal(getVoucherTemplatePreviewText("serviceArea", "long"), "ANTI AGE TREATMENT S INTENZIVNÍ MASÁŽÍ");
});

test("preview fitting zmenšuje písmo k minimu a podporuje více řádků", () => {
  const area = {
    ...defaultVoucherTemplateLayout.serviceArea,
    widthMm: 45,
    heightMm: 11,
    maxLines: 2,
  };
  const fit = fitVoucherTemplatePreviewText("ANTI AGE TREATMENT S INTENZIVNÍ MASÁŽÍ", area);

  assert.ok(fit.fontSizePt >= area.typography.minFontSizePt);
  assert.ok(fit.lines.length <= area.maxLines);
  assert.ok(fit.lines.length > 1 || fit.overflowed);
});

test("SERVICE long se při dostatečné šířce vejde do povoleného počtu řádků", () => {
  const area = { ...defaultVoucherTemplateLayout.serviceArea, maxLines: 2 };
  const fit = fitVoucherTemplatePreviewText("ANTI AGE TREATMENT S INTENZIVNÍ MASÁŽÍ", area);

  assert.equal(fit.overflowed, false);
  assert.ok(fit.lines.length <= area.maxLines);
  assert.ok(fit.fontSizePt >= area.typography.minFontSizePt);
});

test("SERVICE long při užší šířce wrapuje podle měření a shrinkuje bez překročení minima", () => {
  const area = { ...defaultVoucherTemplateLayout.serviceArea, widthMm: 52, maxLines: 2 };
  const calls: Array<{ text: string; fontSizePt: number; fontWeight: string }> = [];
  const textMeasurer = (text: string, fontSizePt: number, typography: { fontFamilyKey: string; fontWeight: "regular" | "bold" }) => {
    calls.push({ text, fontSizePt, fontWeight: typography.fontWeight });
    return { widthMm: text.length * fontSizePt * 0.16 };
  };
  const fit = fitVoucherTemplatePreviewText("ANTI AGE TREATMENT S INTENZIVNÍ MASÁŽÍ", area, textMeasurer);
  const availableWidthMm = area.widthMm - 2;

  assert.equal(fit.overflowed, false);
  assert.equal(fit.lines.length, 2);
  assert.ok(fit.fontSizePt >= area.typography.minFontSizePt);
  assert.ok(fit.lines.every((line) => textMeasurer(line, fit.fontSizePt, area.typography).widthMm <= availableWidthMm));
  assert.ok(calls.some((call) => call.fontWeight === area.typography.fontWeight));
});

test("fitting nikdy nevrátí více než maxLines ani velikost pod minimum", () => {
  const area = { ...defaultVoucherTemplateLayout.serviceArea, widthMm: 24, maxLines: 1 };
  const fit = fitVoucherTemplatePreviewText("ANTI AGE TREATMENT S INTENZIVNÍ MASÁŽÍ", area);

  assert.ok(fit.lines.length <= area.maxLines);
  assert.ok(fit.fontSizePt >= area.typography.minFontSizePt);
});

test("preview respektuje nulové automatické řádkování a výšku oblasti", () => {
  const area = {
    ...defaultVoucherTemplateLayout.serviceArea,
    widthMm: 34,
    heightMm: 2,
    maxLines: 3,
    typography: { ...defaultVoucherTemplateLayout.serviceArea.typography, lineHeightMm: 0 },
  };
  const fit = fitVoucherTemplatePreviewText("Velmi dlouhý název služby pro kontrolu výšky", area);

  assert.equal(fit.overflowed, true);
  assert.ok(fit.lineHeightMm > 0);
});

test("preview fitting reaguje na řez písma a baseline pozici", () => {
  const regular = fitVoucherTemplatePreviewText("WWWWWWWW", {
    ...defaultVoucherTemplateLayout.codeArea,
    widthMm: 25,
    typography: { ...defaultVoucherTemplateLayout.codeArea.typography, fontWeight: "regular" },
  });
  const bold = fitVoucherTemplatePreviewText("WWWWWWWW", {
    ...defaultVoucherTemplateLayout.codeArea,
    widthMm: 25,
    typography: { ...defaultVoucherTemplateLayout.codeArea.typography, fontWeight: "bold" },
  });
  assert.ok(bold.fontSizePt <= regular.fontSizePt);
  assert.ok(getVoucherTemplatePreviewBaselineTopMm(defaultVoucherTemplateLayout.serviceArea) < defaultVoucherTemplateLayout.serviceArea.heightMm);
});

test("baseline transform převádí PDF baseline na relativní browser top", () => {
  const area = { yMm: 16, heightMm: 8, baselineMm: 18.35 };

  assert.ok(Math.abs(getVoucherTemplatePreviewBaselineTopMm(area) - 5.65) < 1e-12);
  assert.ok(Math.abs(getVoucherTemplatePreviewBaselineTopPx(area, 3) - 16.95) < 1e-12);
});

test("Canvas i červená linka používají stejnou baselinePx", () => {
  const area = { yMm: 16, heightMm: 8, baselineMm: 18.35 };
  const baselinePx = getVoucherTemplatePreviewBaselineTopPx(area, 3);

  assert.equal(getVoucherTemplatePreviewLineBaselinePx(baselinePx, 2, 1, 4, 3), baselinePx);
  assert.equal(getVoucherTemplatePreviewLineBaselinePx(baselinePx, 2, 0, 4, 3), baselinePx - 12);
});

test("dvouřádkový fitting kotví poslední řádek na baseline a předchozí podle lineHeight", () => {
  const area = defaultVoucherTemplateLayout.serviceArea;
  const baselinePx = getVoucherTemplatePreviewBaselineTopPx(area, 3);
  const firstLine = getVoucherTemplatePreviewLineBaselinePx(baselinePx, 2, 0, area.typography.lineHeightMm, 3);
  const lastLine = getVoucherTemplatePreviewLineBaselinePx(baselinePx, 2, 1, area.typography.lineHeightMm, 3);

  assert.equal(lastLine, baselinePx);
  assert.equal(firstLine, baselinePx - area.typography.lineHeightMm * 3);
  assert.ok(firstLine >= 0);
  assert.ok(lastLine <= area.heightMm * 3);
});

test("pt se pro Canvas převádí na fyzické px podle SCALE", () => {
  assert.equal(getVoucherTemplatePreviewFontSizePx(12, 3), 12 * 25.4 / 72 * 3);
});

test("po fittingu se pro Canvas používá výsledná velikost", () => {
  const area = { ...defaultVoucherTemplateLayout.serviceArea, widthMm: 45, maxLines: 2 };
  const fit = fitVoucherTemplatePreviewText("ANTI AGE TREATMENT S INTENZIVNÍ MASÁŽÍ", area);

  assert.ok(fit.fontSizePt >= area.typography.minFontSizePt);
  assert.ok(fit.fontSizePt <= area.typography.preferredFontSizePt);
  assert.equal(getVoucherTemplatePreviewFontSizePx(fit.fontSizePt, 3), fit.fontSizePt * 25.4 / 72 * 3);
});

test("QR preview nemá textovou typografii", () => {
  assert.equal(getVoucherTemplatePreviewText("qrArea", "normal"), null);
});

test("QR preview používá stejnou quiet zone a geometrii jako PDF renderer", () => {
  assert.equal(VOUCHER_TEMPLATE_PREVIEW_QR.dataModules, 33);
  assert.equal(VOUCHER_TEMPLATE_PREVIEW_QR.quietZoneModules, 4);
  assert.equal(VOUCHER_TEMPLATE_PREVIEW_QR.totalModules, 41);
  assert.equal(VOUCHER_TEMPLATE_PREVIEW_QR.isDark(0, 0), false);
  assert.equal(VOUCHER_TEMPLATE_PREVIEW_QR.isDark(4, 4), true);
});

test("QR preview používá origin aktuálního prostředí", () => {
  const qr = createVoucherTemplatePreviewQr("http://192.168.0.150:3000");

  assert.equal(qr.dataModules, 33);
  let differs = false;
  for (let row = 0; row < qr.totalModules; row += 1) {
    for (let column = 0; column < qr.totalModules; column += 1) {
      if (qr.isDark(row, column) !== VOUCHER_TEMPLATE_PREVIEW_QR.isDark(row, column)) differs = true;
    }
  }
  assert.equal(differs, true);
});

test("preview mode visibility matrix nikdy nezobrazí VALUE a SERVICE současně", () => {
  const matrix = {
    VALUE: { valueArea: true, serviceArea: false, validityArea: true, codeArea: true, qrArea: true },
    SERVICE: { valueArea: false, serviceArea: true, validityArea: true, codeArea: true, qrArea: true },
    STOCK: { valueArea: false, serviceArea: false, validityArea: false, codeArea: true, qrArea: true },
  } as const;

  for (const [mode, expected] of Object.entries(matrix) as Array<[keyof typeof matrix, (typeof matrix)[keyof typeof matrix]]>) {
    for (const [areaKey, visible] of Object.entries(expected) as Array<[keyof typeof expected, boolean]>) {
      assert.equal(isVoucherTemplatePreviewAreaVisible(areaKey, mode), visible, `${mode}/${areaKey}`);
    }
    assert.notEqual(isVoucherTemplatePreviewAreaVisible("valueArea", mode) && isVoucherTemplatePreviewAreaVisible("serviceArea", mode), true);
  }
});

test("editor používá pro obsah náhled vyrenderovaný stejným PDF rendererem a save payload obsahuje jen layout", async () => {
  const source = await readFile(new URL("./voucher-template-layout-editor.tsx", import.meta.url), "utf8");

  assert.match(source, /saveVoucherTemplateLayoutAction\(templateId, currentLayout, revision\)/);
  assert.match(source, /test-pdf\?format=preview/);
  assert.match(source, /JSON\.stringify\(\{ layout: layoutRef\.current \}\)/);
  assert.match(source, /const initialEditorLayout = normalizeLayoutBaselines\(initialLayout\)/);
  assert.match(source, /const layoutRef = useRef\(initialEditorLayout\)/);
  assert.match(source, /voucherTemplateLayoutSchema\.safeParse\(layout\)/);
  assert.match(source, /Zkontrolovat PDF pro tisk/);
  assert.match(source, /selected === null \? <div className="flex min-h-48/);
  assert.match(source, /\{saveError \? <p role="alert"/);
  assert.match(source, /const displayedPreviewSrc = renderedPreview\?\.src \?\? previewSrc/);
  assert.match(source, /aria-label="Typ náhledu voucheru"/);
  assert.doesNotMatch(source, /previewType = selected ===/);
  assert.match(source, /format=preview&previewType=\$\{previewType\}/);
  assert.match(source, /setRenderedPreviewSrc/);
  assert.doesNotMatch(source, /PreviewCanvas/);
  assert.doesNotMatch(source, /PreviewQrPlaceholder/);
  assert.match(source, /className="pointer-events-none absolute inset-0 overflow-hidden"/);
  assert.match(source, /-top-6 left-0 z-20/);
  assert.match(source, /labels\[key\]/);
  assert.match(source, /relative .*overflow-visible border/);
  assert.match(source, /isQrArea \? "z-20 border border-dashed/);
  assert.match(source, /QR kód/);
  assert.match(source, /useState<AreaKey \| null>\("valueArea"\)/);
  assert.match(source, /onClick=\{\(\) => setSelected\(null\)\}/);
  assert.match(source, /event\.stopPropagation\(\); selectArea\(key\)/);
  assert.match(source, /Nic není vybráno/);
  assert.match(source, /const canvasScale = canvasSize\.width \* zoom \/ VOUCHER_PRINT_GEOMETRY\.widthMm/);
  assert.match(source, /new ResizeObserver\(measure\)/);
  assert.match(source, /enableResizing=\{isSelected \? cornerResizeEnable : false\}/);
  assert.match(source, /resizeHandleStyles=\{cornerHandleStyles\}/);
  assert.match(source, /lockAspectRatio=\{isAspectRatioLocked\(key\)\}/);
  assert.match(source, /onResize=\{\(_, direction, ref, __, pos\) => applyResize\(key, direction, ref, pos\)\}/);
  assert.match(source, /nudgeAreaInTrim\(layoutRef\.current\[key\], event\.key, event\.shiftKey\)/);
  assert.match(source, /onKeyDown=\{\(event: KeyboardEvent<HTMLDivElement>\) => nudgeAreaByKeyboard\(event, key\)\}/);
  assert.match(source, /Šipkami posunete o 0,1 mm/);
  assert.match(source, /data\.x \/ canvasScale/);
  assert.match(source, /formatNumericValue/);
  assert.match(source, /getVoucherEditorOverlayState/);
  assert.match(source, /data-overlay="bleed"/);
  assert.match(source, /data-overlay="guides"/);
  assert.doesNotMatch(source, /showGuides \|\| isInteracting/);
});

test("uzamčený náhled používá fitting a baseline layoutu", async () => {
  const source = await readFile(new URL("./voucher-template-published-preview.tsx", import.meta.url), "utf8");

  assert.match(source, /fitVoucherTemplatePreviewText\(label, area as VoucherTemplateLayoutV1\["valueArea"\]\)/);
  assert.match(source, /getVoucherTextBaselineBrowserTopMm\(area\)/);
  assert.match(source, /fit\?\.lines\.join\("\\n"\)/);
  assert.match(source, /whiteSpace: fit \? "pre-line"/);
});
