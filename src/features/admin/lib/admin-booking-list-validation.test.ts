import test from "node:test";
import assert from "node:assert/strict";

import { bookingListSearchParamsSchema } from "./admin-booking-list-validation";

test("booking list search params schema accepts view and limit", () => {
  const parsed = bookingListSearchParamsSchema.parse({
    view: "attention",
    limit: "60",
  });

  assert.equal(parsed.view, "attention");
  assert.equal(parsed.limit, 60);
});

test("booking list search params schema rejects invalid limit", () => {
  const parsed = bookingListSearchParamsSchema.safeParse({
    limit: "999",
  });

  assert.equal(parsed.success, false);
});
