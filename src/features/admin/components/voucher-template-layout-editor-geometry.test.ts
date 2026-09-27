import assert from "node:assert/strict";
import test from "node:test";

import { getBaselineWithPreservedTopOffset, getLockedResizeSize, getResizeAnchor, snapToHalfMm } from "./voucher-template-layout-editor-geometry";

const area = { xMm: 20, yMm: 15, widthMm: 30, heightMm: 10 };

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
  const textArea = { yMm: 30.5, heightMm: 11.5, baselineMm: 41.2 };

  assert.equal(getBaselineWithPreservedTopOffset(textArea, 55, textArea.heightMm), 65.7);
});

test("textová baseline při změně výšky zachová odstup od horní hrany", () => {
  const textArea = { yMm: 30.5, heightMm: 11.5, baselineMm: 41.2 };

  assert.equal(getBaselineWithPreservedTopOffset(textArea, textArea.yMm, 20), 49.7);
});
