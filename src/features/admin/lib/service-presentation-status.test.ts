import assert from "node:assert/strict";
import test from "node:test";

import {
  applyServicePresentationStatus,
  getServicePresentationStatus,
  servicePresentationStatusLabels,
} from "./service-presentation-status";

test("prezentační stav pokrývá všechny kombinace provozních příznaků", () => {
  assert.equal(getServicePresentationStatus({ isActive: true, isPubliclyBookable: true }), "public");
  assert.equal(getServicePresentationStatus({ isActive: true, isPubliclyBookable: false }), "internal");
  assert.equal(getServicePresentationStatus({ isActive: false, isPubliclyBookable: true }), "inactive");
  assert.equal(getServicePresentationStatus({ isActive: false, isPubliclyBookable: false }), "inactive");
});

test("kritické přechody zachovají online režim při deaktivaci a nastaví jej při aktivaci", () => {
  const wasPublic = { isActive: false, isPubliclyBookable: true };

  assert.equal(getServicePresentationStatus(wasPublic), "inactive");
  assert.deepEqual(applyServicePresentationStatus(wasPublic, "inactive"), wasPublic);
  assert.deepEqual(applyServicePresentationStatus(wasPublic, "internal"), { isActive: true, isPubliclyBookable: false });
  assert.deepEqual(applyServicePresentationStatus({ isActive: true, isPubliclyBookable: false }, "public"), { isActive: true, isPubliclyBookable: true });
  assert.equal(servicePresentationStatusLabels.internal, "Interní");
});
