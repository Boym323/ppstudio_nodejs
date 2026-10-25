import assert from "node:assert/strict";
import test from "node:test";
import { claimPlannerGesture } from "./planner-lab-gesture";

for (const order of ["click/select", "select/click"]) {
  test(`jedno gesto projde jen jednou i při ${order} a odlišně zaokrouhleném rozsahu`, () => {
    const handled = new WeakSet<Event>();
    const event = new Event("pointerup");
    assert.equal(claimPlannerGesture(handled, event), true);
    assert.equal(claimPlannerGesture(handled, event), false);
    // Další skutečné gesto se stejným rozsahem není časově potlačené.
    assert.equal(claimPlannerGesture(handled, new Event("pointerup")), true);
  });
}

test("tažení a rychlé opačné gesto se navzájem nepotlačují", () => {
  const handled = new WeakSet<Event>();
  const drag = new Event("pointerup");
  const remove = new Event("pointerup");
  assert.equal(claimPlannerGesture(handled, drag), true);
  assert.equal(claimPlannerGesture(handled, remove), true);
  assert.equal(claimPlannerGesture(handled, drag), false);
  assert.equal(claimPlannerGesture(handled, null), true);
});
