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

test("všechny přechody mezi třemi prezentačními stavy uloží očekávané příznaky", () => {
  const transitions = [
    { from: "public", current: { isActive: true, isPubliclyBookable: true }, to: "public", expected: { isActive: true, isPubliclyBookable: true } },
    { from: "public", current: { isActive: true, isPubliclyBookable: true }, to: "internal", expected: { isActive: true, isPubliclyBookable: false } },
    { from: "public", current: { isActive: true, isPubliclyBookable: true }, to: "inactive", expected: { isActive: false, isPubliclyBookable: true } },
    { from: "internal", current: { isActive: true, isPubliclyBookable: false }, to: "public", expected: { isActive: true, isPubliclyBookable: true } },
    { from: "internal", current: { isActive: true, isPubliclyBookable: false }, to: "internal", expected: { isActive: true, isPubliclyBookable: false } },
    { from: "internal", current: { isActive: true, isPubliclyBookable: false }, to: "inactive", expected: { isActive: false, isPubliclyBookable: false } },
    { from: "inactive", current: { isActive: false, isPubliclyBookable: true }, to: "public", expected: { isActive: true, isPubliclyBookable: true } },
    { from: "inactive", current: { isActive: false, isPubliclyBookable: true }, to: "internal", expected: { isActive: true, isPubliclyBookable: false } },
    { from: "inactive", current: { isActive: false, isPubliclyBookable: true }, to: "inactive", expected: { isActive: false, isPubliclyBookable: true } },
  ] as const;

  for (const transition of transitions) {
    assert.equal(getServicePresentationStatus(transition.current), transition.from);
    assert.deepEqual(
      applyServicePresentationStatus(transition.current, transition.to),
      transition.expected,
      `${transition.from} → ${transition.to}`,
    );
  }

  assert.equal(servicePresentationStatusLabels.internal, "Interní");
});
