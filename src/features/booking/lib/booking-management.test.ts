import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

function buildToken(overrides?: Partial<{
  type: "RESCHEDULE" | "CANCEL";
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  bookingStatus: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  scheduledStartsAt: Date;
}>) {
  const scheduledStartsAt = overrides?.scheduledStartsAt ?? new Date(Date.now() + 72 * 60 * 60 * 1000);

  return {
    id: "token-1",
    bookingId: "booking-1",
    type: overrides?.type ?? "RESCHEDULE",
    expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    usedAt: overrides?.usedAt ?? null,
    revokedAt: overrides?.revokedAt ?? null,
    booking: {
      id: "booking-1",
      status: overrides?.bookingStatus ?? "CONFIRMED",
      updatedAt: new Date("2026-04-23T09:00:00.000Z"),
      serviceId: "service-1",
      serviceDurationMinutes: 60,
      serviceNameSnapshot: "Lash lifting",
      clientNameSnapshot: "Jana Nováková",
      scheduledStartsAt,
      scheduledEndsAt: new Date(scheduledStartsAt.getTime() + 60 * 60 * 1000),
    },
  } as const;
}

test("resolvePublicBookingManagementState returns ready for a valid reschedule token", async () => {
  const { resolvePublicBookingManagementState } = await import("./booking-management");

  const result = resolvePublicBookingManagementState(buildToken(), 48);

  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.equal(result.token.booking.serviceNameSnapshot, "Lash lifting");
    assert.equal(result.token.booking.status, "CONFIRMED");
  }
});

test("resolvePublicBookingManagementState rejects invalid token type", async () => {
  const { resolvePublicBookingManagementState } = await import("./booking-management");

  const result = resolvePublicBookingManagementState(buildToken({ type: "CANCEL" }), 48);

  assert.equal(result.status, "invalid");
  assert.match(result.message, /neslouží pro správu rezervace/i);
});

test("resolvePublicBookingManagementState rejects expired token", async () => {
  const { resolvePublicBookingManagementState } = await import("./booking-management");

  const result = resolvePublicBookingManagementState(
    buildToken({ expiresAt: new Date(Date.now() - 60 * 1000) }),
    48,
  );

  assert.equal(result.status, "expired");
  assert.match(result.message, /platnost odkazu už vypršela/i);
});

test("resolvePublicBookingManagementState rejects already used or revoked token", async () => {
  const { resolvePublicBookingManagementState } = await import("./booking-management");

  const usedResult = resolvePublicBookingManagementState(
    buildToken({ usedAt: new Date("2026-04-23T09:30:00.000Z") }),
    48,
  );
  const revokedResult = resolvePublicBookingManagementState(
    buildToken({ revokedAt: new Date("2026-04-23T09:30:00.000Z") }),
    48,
  );

  assert.equal(usedResult.status, "invalid");
  assert.match(usedResult.message, /už není aktivní/i);
  assert.equal(revokedResult.status, "invalid");
  assert.match(revokedResult.message, /už není aktivní/i);
});

test("resolvePublicBookingManagementState rejects cancelled booking", async () => {
  const { resolvePublicBookingManagementState } = await import("./booking-management");

  const result = resolvePublicBookingManagementState(
    buildToken({ bookingStatus: "CANCELLED" }),
    48,
  );

  assert.equal(result.status, "already_cancelled");
  assert.match(result.message, /už byla zrušena/i);
});

test("resolvePublicBookingManagementState rejects closed booking states", async () => {
  const { resolvePublicBookingManagementState } = await import("./booking-management");

  const completedResult = resolvePublicBookingManagementState(
    buildToken({ bookingStatus: "COMPLETED" }),
    48,
  );
  const noShowResult = resolvePublicBookingManagementState(
    buildToken({ bookingStatus: "NO_SHOW" }),
    48,
  );

  assert.equal(completedResult.status, "not_reschedulable");
  assert.match(completedResult.message, /už nelze měnit online/i);
  assert.equal(noShowResult.status, "not_reschedulable");
  assert.match(noShowResult.message, /už nelze měnit online/i);
});

test("resolvePublicBookingManagementState blocks late online reschedule", async () => {
  const { resolvePublicBookingManagementState } = await import("./booking-management");

  const result = resolvePublicBookingManagementState(
    buildToken({
      scheduledStartsAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    }),
    24,
  );

  assert.equal(result.status, "not_reschedulable");
  assert.match(result.message, /méně než 24 hodin/i);
});
