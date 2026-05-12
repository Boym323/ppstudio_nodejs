import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { BookingActionTokenType, BookingStatus } from "@prisma/client";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

type BookingEmailActionTokenOverrides = Partial<{
  type: BookingActionTokenType;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  bookingStatus: BookingStatus;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
}>;

async function loadModule() {
  return import("./booking-email-actions");
}

function buildToken(overrides: BookingEmailActionTokenOverrides = {}) {
  const scheduledStartsAt = new Date("2026-06-10T08:00:00.000Z");
  const scheduledEndsAt = new Date("2026-06-10T09:30:00.000Z");

  return {
    id: "action-token-1",
    bookingId: "booking-1",
    type: overrides.type ?? BookingActionTokenType.APPROVE,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    usedAt: overrides.usedAt ?? null,
    revokedAt: overrides.revokedAt ?? null,
    booking: {
      id: "booking-1",
      status: overrides.bookingStatus ?? BookingStatus.PENDING,
      confirmedAt: overrides.confirmedAt ?? null,
      cancelledAt: overrides.cancelledAt ?? null,
      clientId: "client-1",
      clientNameSnapshot: "Jana Novakova",
      clientEmailSnapshot: "jana@example.com",
      serviceNameSnapshot: "Lash lifting",
      scheduledStartsAt,
      scheduledEndsAt,
    },
  } as const;
}

describe("resolveBookingEmailActionPageState", () => {
  test("returns ready state for pending approve token", async () => {
    const { resolveBookingEmailActionPageState } = await loadModule();

    const result = resolveBookingEmailActionPageState(buildToken(), "approve");

    assert.equal(result.status, "ready");
    if (result.status === "ready") {
      assert.equal(result.intent, "approve");
      assert.equal(result.actionLabel, "Schválení rezervace");
      assert.equal(result.serviceName, "Lash lifting");
      assert.equal(result.clientName, "Jana Novakova");
    }
  });

  test("rejects token that does not match requested email action", async () => {
    const { resolveBookingEmailActionPageState } = await loadModule();

    const result = resolveBookingEmailActionPageState(buildToken(), "reject");

    assert.equal(result.status, "invalid");
    assert.match(result.title, /nesouhlasí s požadovanou akcí/i);
  });

  test("rejects expired action token with booking details", async () => {
    const { resolveBookingEmailActionPageState } = await loadModule();

    const result = resolveBookingEmailActionPageState(
      buildToken({
        expiresAt: new Date(Date.now() - 60 * 1000),
      }),
      "approve",
    );

    assert.equal(result.status, "expired");
    assert.equal(result.serviceName, "Lash lifting");
    assert.match(result.title, /platnost odkazu vypršela/i);
  });

  test("rejects already processed token after first use", async () => {
    const { resolveBookingEmailActionPageState } = await loadModule();

    const result = resolveBookingEmailActionPageState(
      buildToken({
        usedAt: new Date("2026-06-09T09:00:00.000Z"),
      }),
      "approve",
    );

    assert.equal(result.status, "already_processed");
    assert.match(result.message, /už byla dříve zpracována/i);
  });

  test("returns already confirmed state when booking was confirmed elsewhere", async () => {
    const { resolveBookingEmailActionPageState } = await loadModule();

    const result = resolveBookingEmailActionPageState(
      buildToken({
        bookingStatus: BookingStatus.CONFIRMED,
        confirmedAt: new Date("2026-06-09T09:00:00.000Z"),
      }),
      "approve",
    );

    assert.equal(result.status, "already_confirmed");
    assert.match(result.message, /už byla dříve potvrzena/i);
  });

  test("returns already cancelled state when booking was cancelled elsewhere", async () => {
    const { resolveBookingEmailActionPageState } = await loadModule();

    const result = resolveBookingEmailActionPageState(
      buildToken({
        type: BookingActionTokenType.REJECT,
        bookingStatus: BookingStatus.CANCELLED,
        cancelledAt: new Date("2026-06-09T09:00:00.000Z"),
      }),
      "reject",
    );

    assert.equal(result.status, "already_cancelled");
    assert.match(result.message, /už byla dříve zrušena/i);
  });
});
