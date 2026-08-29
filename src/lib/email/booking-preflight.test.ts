import assert from "node:assert/strict";
import test from "node:test";

import {
  BookingStatus,
  EmailAudience,
  EmailLogType,
} from "@/generated/prisma/browser";

import { evaluateBookingEmailPreflight } from "./booking-preflight";

const scheduledStartsAt = new Date("2026-08-30T10:00:00.000Z");
const scheduledEndsAt = new Date("2026-08-30T11:00:00.000Z");
const booking = {
  status: BookingStatus.CONFIRMED,
  scheduledStartsAt,
  scheduledEndsAt,
};

function payload(overrides: Record<string, unknown> = {}) {
  return {
    scheduledStartsAt: scheduledStartsAt.toISOString(),
    scheduledEndsAt: scheduledEndsAt.toISOString(),
    ...overrides,
  };
}

test("confirmed client email requires the current confirmed booking and term", () => {
  const stale = evaluateBookingEmailPreflight({
    type: EmailLogType.BOOKING_CONFIRMED,
    audience: EmailAudience.CLIENT,
    templateKey: "booking-approved-v1",
    payload: payload(),
    booking: { ...booking, status: BookingStatus.CANCELLED },
  });
  const moved = evaluateBookingEmailPreflight({
    type: EmailLogType.BOOKING_CONFIRMED,
    audience: EmailAudience.CLIENT,
    templateKey: "booking-approved-v1",
    payload: payload(),
    booking: { ...booking, scheduledStartsAt: new Date("2026-08-30T12:00:00.000Z") },
  });
  const valid = evaluateBookingEmailPreflight({
    type: EmailLogType.BOOKING_CONFIRMED,
    audience: EmailAudience.CLIENT,
    templateKey: "booking-approved-v1",
    payload: payload(),
    booking,
  });

  assert.equal(stale.shouldSend, false);
  assert.equal(moved.shouldSend, false);
  assert.equal(valid.shouldSend, true);
});

test("reschedule client email requires the current term, while admin history remains deliverable", () => {
  const stale = evaluateBookingEmailPreflight({
    type: EmailLogType.BOOKING_RESCHEDULED,
    audience: EmailAudience.CLIENT,
    templateKey: "booking-rescheduled-v1",
    payload: payload(),
    booking: { ...booking, scheduledStartsAt: new Date("2026-08-30T12:00:00.000Z") },
  });
  const admin = evaluateBookingEmailPreflight({
    type: EmailLogType.BOOKING_RESCHEDULED,
    audience: EmailAudience.ADMIN,
    templateKey: "admin-booking-rescheduled-v1",
    payload: payload(),
    booking: { ...booking, scheduledStartsAt: new Date("2026-08-30T12:00:00.000Z") },
  });

  assert.equal(stale.shouldSend, false);
  assert.equal(admin.shouldSend, true);
});

test("cancellation and rejection client emails require CANCELLED", () => {
  const pending = evaluateBookingEmailPreflight({
    type: EmailLogType.BOOKING_CANCELLED,
    audience: EmailAudience.CLIENT,
    templateKey: "booking-rejected-v1",
    payload: payload(),
    booking,
  });
  const cancelled = evaluateBookingEmailPreflight({
    type: EmailLogType.BOOKING_CANCELLED,
    audience: EmailAudience.CLIENT,
    templateKey: "booking-cancelled-v1",
    payload: payload(),
    booking: { ...booking, status: BookingStatus.CANCELLED },
  });

  assert.equal(pending.shouldSend, false);
  assert.equal(cancelled.shouldSend, true);
});

test("received client email requires a still-pending booking and unchanged term", () => {
  const valid = evaluateBookingEmailPreflight({
    type: EmailLogType.BOOKING_RECEIVED,
    audience: EmailAudience.CLIENT,
    templateKey: "booking-confirmation-v1",
    payload: payload(),
    booking: { ...booking, status: BookingStatus.PENDING },
  });
  const approved = evaluateBookingEmailPreflight({
    type: EmailLogType.BOOKING_RECEIVED,
    audience: EmailAudience.CLIENT,
    templateKey: "booking-confirmation-v1",
    payload: payload(),
    booking,
  });

  assert.equal(valid.shouldSend, true);
  assert.equal(approved.shouldSend, false);
});
