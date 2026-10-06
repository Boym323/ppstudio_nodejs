import assert from "node:assert/strict";
import test from "node:test";

import { getVoucherEditorGuideGeometry, getVoucherEditorOverlayState } from "./voucher-template-layout-editor-overlays";

test("trim, bezpečná zóna a středová vodítka používají finální ořez", () => {
  const guides = getVoucherEditorGuideGeometry();
  assert.deepEqual(guides.trim, { leftMm: 3, topMm: 3, widthMm: 210, heightMm: 99 });
  assert.deepEqual(guides.safe, { leftMm: 6, topMm: 6, widthMm: 204, heightMm: 93 });
  assert.deepEqual(guides.center, { xMm: 108, yMm: 52.5 });
  assert.equal(guides.center.xMm - guides.trim.leftMm, 105);
  assert.equal(guides.center.yMm - guides.trim.topMm, 49.5);
});

test("vodítka se zobrazí jen při zapnutém toggle a během interakce se zvýrazní", () => {
  assert.deepEqual(getVoucherEditorOverlayState({ showGuides: true, showBleed: false, isInteracting: false }), {
    guidesVisible: true,
    guidesEmphasized: false,
    bleedVisible: false,
  });
  assert.deepEqual(getVoucherEditorOverlayState({ showGuides: true, showBleed: false, isInteracting: true }), {
    guidesVisible: true,
    guidesEmphasized: true,
    bleedVisible: false,
  });
  assert.equal(getVoucherEditorOverlayState({ showGuides: false, showBleed: false, isInteracting: true }).guidesVisible, false);
});

test("spadávka ovládá pouze pracovní overlay", () => {
  assert.equal(getVoucherEditorOverlayState({ showGuides: false, showBleed: true, isInteracting: false }).bleedVisible, true);
  assert.equal(getVoucherEditorOverlayState({ showGuides: false, showBleed: false, isInteracting: false }).bleedVisible, false);
});
