import assert from "node:assert/strict";
import test from "node:test";

import { BookingStatus } from "@/generated/prisma/browser";

test("admin cancellation notification defaults to enabled and is shown only for cancellation", async () => {
  const {
    DEFAULT_ADMIN_BOOKING_NOTIFY_CLIENT,
    shouldShowAdminBookingCancellationNotification,
  } = await import("./admin-booking-cancellation-notification");

  assert.equal(DEFAULT_ADMIN_BOOKING_NOTIFY_CLIENT, true);
  assert.equal(
    shouldShowAdminBookingCancellationNotification(BookingStatus.CANCELLED),
    true,
  );
  assert.equal(
    shouldShowAdminBookingCancellationNotification(BookingStatus.CONFIRMED),
    false,
  );
  assert.equal(
    shouldShowAdminBookingCancellationNotification(BookingStatus.COMPLETED),
    false,
  );
});

test("admin cancellation notification recognizes a missing current client email", async () => {
  const { hasCurrentClientEmail } = await import("./admin-booking-cancellation-notification");

  assert.equal(hasCurrentClientEmail(" klientka@example.com "), true);
  assert.equal(hasCurrentClientEmail("  "), false);
});
