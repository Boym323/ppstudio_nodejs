import assert from "node:assert/strict";
import test from "node:test";

import { BookingStatus } from "@prisma/client";

import {
  getClientCrmSummary,
  type ClientCrmSummaryBookingInput,
} from "./client-crm-summary";

const now = new Date("2026-05-02T10:00:00.000Z");

function booking(overrides: Partial<ClientCrmSummaryBookingInput> = {}): ClientCrmSummaryBookingInput {
  return {
    id: overrides.id ?? "booking-1",
    status: overrides.status ?? BookingStatus.CONFIRMED,
    serviceNameSnapshot: overrides.serviceNameSnapshot ?? "Kosmetické ošetření",
    servicePriceFromCzk: overrides.servicePriceFromCzk ?? 1_200,
    scheduledStartsAt: overrides.scheduledStartsAt ?? new Date("2026-05-03T10:00:00.000Z"),
    scheduledEndsAt: overrides.scheduledEndsAt ?? new Date("2026-05-03T11:00:00.000Z"),
    voucherRedemptions: overrides.voucherRedemptions ?? [],
    payments: overrides.payments ?? [],
  };
}

test("getClientCrmSummary handles client without bookings", () => {
  const summary = getClientCrmSummary([], { now });

  assert.equal(summary.lastVisit, null);
  assert.equal(summary.nextVisit, null);
  assert.equal(summary.servicesValueCzk, 0);
  assert.equal(summary.paidCzk, 0);
  assert.equal(summary.unpaidCzk, 0);
  assert.equal(summary.totalBookings, 0);
});

test("getClientCrmSummary finds completed past booking as last visit", () => {
  const summary = getClientCrmSummary([
    booking({
      id: "older",
      status: BookingStatus.COMPLETED,
      serviceNameSnapshot: "Starší návštěva",
      scheduledStartsAt: new Date("2026-04-01T10:00:00.000Z"),
      scheduledEndsAt: new Date("2026-04-01T11:00:00.000Z"),
    }),
    booking({
      id: "latest",
      status: BookingStatus.COMPLETED,
      serviceNameSnapshot: "Poslední návštěva",
      scheduledStartsAt: new Date("2026-04-30T10:00:00.000Z"),
      scheduledEndsAt: new Date("2026-04-30T11:00:00.000Z"),
    }),
  ], { now });

  assert.equal(summary.lastVisit?.id, "latest");
  assert.equal(summary.lastVisit?.serviceName, "Poslední návštěva");
  assert.equal(summary.completedBookings, 2);
  assert.equal(summary.servicesValueCzk, 2_400);
});

test("getClientCrmSummary finds nearest future active booking as next visit", () => {
  const summary = getClientCrmSummary([
    booking({
      id: "later",
      status: BookingStatus.CONFIRMED,
      scheduledStartsAt: new Date("2026-05-10T10:00:00.000Z"),
      scheduledEndsAt: new Date("2026-05-10T11:00:00.000Z"),
    }),
    booking({
      id: "nearest",
      status: BookingStatus.PENDING,
      scheduledStartsAt: new Date("2026-05-03T10:00:00.000Z"),
      scheduledEndsAt: new Date("2026-05-03T11:00:00.000Z"),
    }),
    booking({
      id: "cancelled",
      status: BookingStatus.CANCELLED,
      scheduledStartsAt: new Date("2026-05-02T12:00:00.000Z"),
      scheduledEndsAt: new Date("2026-05-02T13:00:00.000Z"),
    }),
  ], { now });

  assert.equal(summary.nextVisit?.id, "nearest");
  assert.equal(summary.activeBookings, 2);
});

test("getClientCrmSummary counts partially paid booking", () => {
  const summary = getClientCrmSummary([
    booking({
      status: BookingStatus.CONFIRMED,
      servicePriceFromCzk: 1_500,
      voucherRedemptions: [{ amountCzk: 400 }],
      payments: [{ amountCzk: 600 }],
    }),
  ], { now });

  assert.equal(summary.paidCzk, 1_000);
  assert.equal(summary.unpaidCzk, 500);
});

test("getClientCrmSummary clamps overpaid booking unpaid value to zero", () => {
  const summary = getClientCrmSummary([
    booking({
      status: BookingStatus.COMPLETED,
      servicePriceFromCzk: 1_200,
      scheduledStartsAt: new Date("2026-04-30T10:00:00.000Z"),
      scheduledEndsAt: new Date("2026-04-30T11:00:00.000Z"),
      voucherRedemptions: [{ amountCzk: 500 }],
      payments: [{ amountCzk: 900 }],
    }),
  ], { now });

  assert.equal(summary.paidCzk, 1_400);
  assert.equal(summary.unpaidCzk, 0);
});

test("getClientCrmSummary excludes cancelled bookings from unpaid total", () => {
  const summary = getClientCrmSummary([
    booking({
      status: BookingStatus.CANCELLED,
      servicePriceFromCzk: 1_500,
      voucherRedemptions: [],
      payments: [],
    }),
  ], { now });

  assert.equal(summary.paidCzk, 0);
  assert.equal(summary.unpaidCzk, 0);
  assert.equal(summary.cancelledBookings, 1);
});
