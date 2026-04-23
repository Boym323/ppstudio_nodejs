import assert from "node:assert/strict";
import test from "node:test";

import { BookingStatus } from "@prisma/client";

async function loadReminderModule() {
  process.env.NEXT_PUBLIC_APP_NAME = "PP Studio";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
  process.env.ADMIN_SESSION_SECRET = "test-secret-value-with-at-least-32-chars";
  process.env.ADMIN_OWNER_EMAIL = "owner@example.com";
  process.env.ADMIN_OWNER_PASSWORD = "change-me-owner";
  process.env.ADMIN_STAFF_EMAIL = "staff@example.com";
  process.env.ADMIN_STAFF_PASSWORD = "change-me-staff";
  process.env.EMAIL_DELIVERY_MODE = "log";

  return import("./booking-reminders");
}

test("getBookingReminder24hWindow returns a 23h to 25h selection window", async () => {
  const { getBookingReminder24hWindow } = await loadReminderModule();
  const now = new Date("2026-04-23T10:00:00.000Z");
  const window = getBookingReminder24hWindow(now);

  assert.equal(window.windowStart.toISOString(), "2026-04-24T09:00:00.000Z");
  assert.equal(window.windowEnd.toISOString(), "2026-04-24T11:00:00.000Z");
});

test("evaluateBookingReminderDelivery allows confirmed bookings still in the reminder window", async () => {
  const { evaluateBookingReminderDelivery } = await loadReminderModule();
  const result = evaluateBookingReminderDelivery({
    bookingStatus: BookingStatus.CONFIRMED,
    reminder24hSentAt: null,
    scheduledStartsAt: new Date("2026-04-24T09:30:00.000Z"),
    now: new Date("2026-04-23T10:00:00.000Z"),
  });

  assert.equal(result.shouldSend, true);
});

test("evaluateBookingReminderDelivery blocks reminders for cancelled bookings", async () => {
  const { evaluateBookingReminderDelivery } = await loadReminderModule();
  const result = evaluateBookingReminderDelivery({
    bookingStatus: BookingStatus.CANCELLED,
    reminder24hSentAt: null,
    scheduledStartsAt: new Date("2026-04-24T09:30:00.000Z"),
    now: new Date("2026-04-23T10:00:00.000Z"),
  });

  assert.equal(result.shouldSend, false);
  assert.match(result.reason ?? "", /no longer confirmed/i);
});

test("evaluateBookingReminderDelivery blocks reminders already marked as sent", async () => {
  const { evaluateBookingReminderDelivery } = await loadReminderModule();
  const result = evaluateBookingReminderDelivery({
    bookingStatus: BookingStatus.CONFIRMED,
    reminder24hSentAt: new Date("2026-04-23T10:05:00.000Z"),
    scheduledStartsAt: new Date("2026-04-24T09:30:00.000Z"),
    now: new Date("2026-04-23T10:00:00.000Z"),
  });

  assert.equal(result.shouldSend, false);
  assert.match(result.reason ?? "", /already marked as sent/i);
});

test("evaluateBookingReminderDelivery blocks bookings moved outside the reminder window", async () => {
  const { evaluateBookingReminderDelivery } = await loadReminderModule();
  const result = evaluateBookingReminderDelivery({
    bookingStatus: BookingStatus.CONFIRMED,
    reminder24hSentAt: null,
    scheduledStartsAt: new Date("2026-04-24T12:30:00.000Z"),
    now: new Date("2026-04-23T10:00:00.000Z"),
  });

  assert.equal(result.shouldSend, false);
  assert.match(result.reason ?? "", /outside the reminder window/i);
});
