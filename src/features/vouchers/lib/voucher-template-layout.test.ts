import assert from "node:assert/strict";
import test from "node:test";
import QRCode from "qrcode";

import { browserTopToPdfBottom, isVoucherTemplateTextAreaKey, pdfBottomToBrowserTop, updateTypography, voucherTemplateLayoutSchema, voucherTemplateStoredLayoutSchema, VOUCHER_QR_MIN_SIZE_MM } from "./voucher-template-layout";
import { defaultVoucherTemplateLayout } from "./voucher-template-defaults";

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

test("typografický nested update zachová ostatní vlastnosti", () => {
  const updatedPreferred = updateTypography(defaultVoucherTemplateLayout, "serviceArea", { preferredFontSizePt: 12 });
  assert.equal(updatedPreferred.serviceArea.typography.preferredFontSizePt, 12);
  assert.equal(updatedPreferred.serviceArea.typography.minFontSizePt, 8.5);
  assert.equal(updatedPreferred.serviceArea.typography.fontFamilyKey, "noto-sans");
  assert.deepEqual(updatedPreferred.serviceArea.typography.color, defaultVoucherTemplateLayout.serviceArea.typography.color);

  const updatedWeight = updateTypography(updatedPreferred, "serviceArea", { fontWeight: "regular" });
  assert.equal(updatedWeight.serviceArea.typography.fontWeight, "regular");
  assert.equal(updatedWeight.serviceArea.typography.fontFamilyKey, "noto-sans");
  assert.deepEqual(updatedWeight.serviceArea.typography.color, defaultVoucherTemplateLayout.serviceArea.typography.color);
});

test("schema přijme validní velikosti a odmítne minimum nad preferovanou velikostí", () => {
  const valid = { ...defaultVoucherTemplateLayout, serviceArea: { ...defaultVoucherTemplateLayout.serviceArea, typography: { ...defaultVoucherTemplateLayout.serviceArea.typography, preferredFontSizePt: 12, minFontSizePt: 7 } } };
  const invalid = { ...valid, serviceArea: { ...valid.serviceArea, typography: { ...valid.serviceArea.typography, minFontSizePt: 13 } } };
  assert.equal(voucherTemplateLayoutSchema.safeParse(valid).success, true);
  const result = voucherTemplateLayoutSchema.safeParse(invalid);
  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.error.issues[0]?.message, "Minimální velikost písma nesmí být vyšší než preferovaná.");
});

test("QR oblast není typografická oblast", () => {
  assert.equal(isVoucherTemplateTextAreaKey("qrArea"), false);
  assert.equal(isVoucherTemplateTextAreaKey("serviceArea"), true);
});

test("dynamický obsah nesmí zasahovat do 3mm spadávky", () => {
  const invalidText = {
    ...defaultVoucherTemplateLayout,
    valueArea: { ...defaultVoucherTemplateLayout.valueArea, xMm: 2.5 },
  };
  const invalidQr = {
    ...defaultVoucherTemplateLayout,
    qrArea: { ...defaultVoucherTemplateLayout.qrArea, xMm: 2.5 },
  };

  const textResult = voucherTemplateLayoutSchema.safeParse(invalidText);
  const qrResult = voucherTemplateLayoutSchema.safeParse(invalidQr);
  assert.equal(textResult.success, false);
  assert.equal(qrResult.success, false);
  if (!textResult.success) assert.match(textResult.error.issues.map((issue) => issue.message).join(" "), /ořezové oblasti/);
  if (!qrResult.success) assert.match(qrResult.error.issues.map((issue) => issue.message).join(" "), /ořezové oblasti/);

  assert.equal(voucherTemplateStoredLayoutSchema.safeParse(invalidText).success, true);
  assert.equal(voucherTemplateStoredLayoutSchema.safeParse(invalidQr).success, true);
});

test("historické malé QR lze číst, nové malé QR nelze uložit", () => {
  const old = { ...defaultVoucherTemplateLayout, qrArea: { ...defaultVoucherTemplateLayout.qrArea, widthMm: 5, heightMm: 5 } };
  assert.equal(voucherTemplateStoredLayoutSchema.safeParse(old).success, true);
  assert.equal(voucherTemplateLayoutSchema.safeParse(old).success, false);
  const minimum = { ...old, qrArea: { ...old.qrArea, widthMm: VOUCHER_QR_MIN_SIZE_MM, heightMm: VOUCHER_QR_MIN_SIZE_MM } };
  assert.equal(voucherTemplateLayoutSchema.safeParse(minimum).success, true);
  assert.equal(voucherTemplateLayoutSchema.safeParse(defaultVoucherTemplateLayout).success, true);
});

test("minimum QR drží tisknutelný modul pro produkční ověřovací URL", () => {
  const qr = QRCode.create("https://ppstudio.cz/vouchery/overeni?code=PP-2026-ABCDEF", { errorCorrectionLevel: "M" });
  assert.equal(qr.version, 4);
  assert.equal(qr.modules.size, 33);
  assert.ok(VOUCHER_QR_MIN_SIZE_MM / (qr.modules.size + 8) >= 0.48); // 4modulová quiet zone na každé straně
});

test("strict layout odmítne překrývající se explicitní řádkování", () => {
  for (const lineHeightMm of [0, 4.2]) {
    const layout = { ...defaultVoucherTemplateLayout, serviceArea: { ...defaultVoucherTemplateLayout.serviceArea, typography: { ...defaultVoucherTemplateLayout.serviceArea.typography, lineHeightMm } } };
    assert.equal(voucherTemplateLayoutSchema.safeParse(layout).success, true);
  }
  const invalid = { ...defaultVoucherTemplateLayout, serviceArea: { ...defaultVoucherTemplateLayout.serviceArea, typography: { ...defaultVoucherTemplateLayout.serviceArea.typography, lineHeightMm: 0.1 } } };
  assert.equal(voucherTemplateStoredLayoutSchema.safeParse(invalid).success, true);
  assert.equal(voucherTemplateLayoutSchema.safeParse(invalid).success, false);
});
