import assert from "node:assert/strict";
import test from "node:test";

import { getVoucherEditorOverlayState } from "./voucher-template-layout-editor-overlays";

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
