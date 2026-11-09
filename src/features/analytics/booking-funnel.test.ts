import assert from "node:assert/strict";
import test from "node:test";

import { BOOKING_FUNNEL_ACTIONS, getBookingFunnelStagesSince } from "./booking-funnel";

test("funnel doplní předchozí kroky v pořadí pro předvýběr a obnovu rezervace", () => {
  assert.deepEqual(getBookingFunnelStagesSince(-1, "service"), ["viewed", "service"]);
  assert.deepEqual(getBookingFunnelStagesSince(1, "contact"), ["term", "contact"]);
  assert.deepEqual(getBookingFunnelStagesSince(-1, "created"), [
    "viewed", "service", "term", "contact", "submitted", "created",
  ]);
});

test("funnel při návratu či opětovném výběru stejné služby nevytvoří další krok", () => {
  assert.deepEqual(getBookingFunnelStagesSince(3, "contact"), []);
  assert.deepEqual(getBookingFunnelStagesSince(3, "service"), []);
  assert.deepEqual(getBookingFunnelStagesSince(4, "created"), ["created"]);
});

test("funnel používá pevné neosobní názvy událostí", () => {
  assert.deepEqual(Object.keys(BOOKING_FUNNEL_ACTIONS), [
    "viewed", "service", "term", "contact", "submitted", "created",
  ]);
  assert.ok(Object.values(BOOKING_FUNNEL_ACTIONS).every((action) => /^0[1-6] /.test(action)));
});
