import test from "node:test";
import assert from "node:assert/strict";

import { bookingListSearchParamsSchema } from "./admin-booking-list-validation";

test("booking list search params schema accepts progressive disclosure params", () => {
  const parsed = bookingListSearchParamsSchema.parse({
    showPast: "1",
    needsClosureLimit: "24",
    pendingLimit: "18",
    upcomingLimit: "36",
    pastLimit: "48",
  });

  assert.equal(parsed.showPast, "1");
  assert.equal(parsed.needsClosureLimit, 24);
  assert.equal(parsed.pendingLimit, 18);
  assert.equal(parsed.upcomingLimit, 36);
  assert.equal(parsed.pastLimit, 48);
});

test("booking list search params schema rejects invalid group limits", () => {
  const parsed = bookingListSearchParamsSchema.safeParse({
    pastLimit: "999",
  });

  assert.equal(parsed.success, false);
});
