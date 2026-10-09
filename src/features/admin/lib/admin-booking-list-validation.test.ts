import test from "node:test";
import assert from "node:assert/strict";

import { bookingListSearchParamsSchema } from "./admin-booking-list-validation";

test("booking list search params schema accepts view and page", () => {
  const parsed = bookingListSearchParamsSchema.parse({
    view: "attention",
    page: "3",
  });

  assert.equal(parsed.view, "attention");
  assert.equal(parsed.page, 3);
});

test("booking list search params schema rejects invalid page", () => {
  const parsed = bookingListSearchParamsSchema.safeParse({
    page: "0",
  });

  assert.equal(parsed.success, false);
});
