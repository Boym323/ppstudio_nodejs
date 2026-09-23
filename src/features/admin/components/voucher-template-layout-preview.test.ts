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
  getVoucherTemplatePreviewText,
  isVoucherTemplatePreviewAreaVisible,
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

test("preview režim, scénář, fixture text i Canvas stav jsou lokální a save payload obsahuje jen layout", async () => {
  const source = await readFile(new URL("./voucher-template-layout-editor.tsx", import.meta.url), "utf8");

  assert.match(source, /const \[previewMode, setPreviewMode\] = useState/);
  assert.match(source, /const \[serviceScenario, setServiceScenario\] = useState/);
  assert.match(source, /saveVoucherTemplateLayoutAction\(templateId, layout\)/);
  assert.doesNotMatch(source, /saveVoucherTemplateLayoutAction\(templateId, .*?(previewMode|serviceScenario|preview)/);
  assert.match(source, /<PreviewCanvas area=/);
  assert.match(source, /baselinePx=\{baselinePx\}/);
  assert.match(source, /getVoucherTemplatePreviewFontSizePx\(preview\.fit\.fontSizePt, SCALE\)/);
  assert.match(source, /className="pointer-events-none absolute inset-0 z-10"/);
  assert.match(source, /context\.textAlign = area\.typography\.alignment/);
  assert.match(source, /context\.font = .*getVoucherTemplatePreviewFontSizePx\(preview\.fit\.fontSizePt, SCALE\)/);
  assert.doesNotMatch(source, /function PreviewText\(/);
});
