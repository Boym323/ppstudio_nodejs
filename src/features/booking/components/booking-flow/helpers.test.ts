import assert from "node:assert/strict";
import test from "node:test";

import { formatSlotTime, getSlotDateKey } from "./helpers";

test("public booking client displays catalog ISO times as Prague salon time", () => {
  const winterStartsAt = "2026-01-15T08:00:00.000Z";
  const summerStartsAt = "2026-07-15T07:00:00.000Z";

  assert.equal(getSlotDateKey(winterStartsAt), "2026-01-15");
  assert.equal(formatSlotTime(winterStartsAt), "09:00");
  assert.equal(getSlotDateKey(summerStartsAt), "2026-07-15");
  assert.equal(formatSlotTime(summerStartsAt), "09:00");
});
