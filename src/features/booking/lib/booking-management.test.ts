import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { BookingStatus } from "@prisma/client";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

type BookingTokenOverrides = Partial<{
  bookingId: string;
  type: "RESCHEDULE" | "CANCEL";
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  bookingStatus: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  scheduledStartsAt: Date;
  updatedAt: Date;
}>;

function buildToken(overrides: BookingTokenOverrides = {}) {
  const scheduledStartsAt = overrides.scheduledStartsAt ?? new Date("2026-04-26T09:00:00.000Z");
  const bookingId = overrides.bookingId ?? "booking-1";

  return {
    id: `token-${bookingId}`,
    bookingId,
    type: overrides.type ?? "RESCHEDULE",
    expiresAt: overrides.expiresAt ?? new Date("2026-04-25T09:00:00.000Z"),
    usedAt: overrides.usedAt ?? null,
    revokedAt: overrides.revokedAt ?? null,
    booking: {
      id: bookingId,
      status: overrides.bookingStatus ?? "CONFIRMED",
      updatedAt: overrides.updatedAt ?? new Date("2026-04-23T09:00:00.000Z"),
      serviceId: "service-1",
      serviceDurationMinutes: 60,
      serviceNameSnapshot: `Service for ${bookingId}`,
      clientNameSnapshot: `Client for ${bookingId}`,
      scheduledStartsAt,
      scheduledEndsAt: new Date(scheduledStartsAt.getTime() + 60 * 60 * 1000),
    },
  } as const;
}

describe("public token access", () => {
  test("returns booking for valid public token", async () => {
    const { createBookingManagementApi } = await import("./booking-management");
    const { hashBookingActionToken } = await import("./booking-action-tokens");
    const expectedToken = buildToken({ bookingId: "booking-1" });
    const api = createBookingManagementApi({
      findManageToken: async (tokenHash) => {
        assert.equal(tokenHash, hashBookingActionToken("valid-token"));
        return expectedToken;
      },
      getBookingPolicySettings: async () => ({ cancellationHours: 48, minAdvanceHours: 2, maxAdvanceDays: 90 }),
      getPublicBookingCatalog: async () => ({ slots: [{ id: "slot-1" }] }),
      issueCancellationUrl: async (bookingId) => {
        assert.equal(bookingId, "booking-1");
        return "https://example.com/cancel/booking-1";
      },
      rescheduleBooking: async () => {
        throw new Error("rescheduleBooking should not be called");
      },
    });

    const result = await api.getPublicBookingManagementPageState("valid-token");

    assert.equal(result.status, "ready");
    if (result.status === "ready") {
      assert.equal(result.bookingId, "booking-1");
      assert.equal(result.serviceName, "Service for booking-1");
      assert.equal(result.clientName, "Client for booking-1");
      assert.equal(result.cancellationUrl, "https://example.com/cancel/booking-1");
    }
  });

  test("returns invalid for unknown public token", async () => {
    const { createBookingManagementApi } = await import("./booking-management");
    const api = createBookingManagementApi({
      findManageToken: async () => null,
      getBookingPolicySettings: async () => ({ cancellationHours: 48, minAdvanceHours: 2, maxAdvanceDays: 90 }),
      getPublicBookingCatalog: async () => {
        throw new Error("catalog should not be loaded for invalid token");
      },
      issueCancellationUrl: async () => {
        throw new Error("cancellation URL should not be issued for invalid token");
      },
      rescheduleBooking: async () => {
        throw new Error("rescheduleBooking should not be called");
      },
    });

    const result = await api.getPublicBookingManagementPageState("missing-token");

    assert.equal(result.status, "invalid");
    assert.match(result.message, /neplatný nebo už neexistuje/i);
  });

  test("returns only the booking matched by the provided token hash", async () => {
    const { createBookingManagementApi } = await import("./booking-management");
    const { hashBookingActionToken } = await import("./booking-action-tokens");
    const firstToken = buildToken({ bookingId: "booking-1" });
    const secondToken = buildToken({ bookingId: "booking-2" });
    const tokenMap = new Map([
      [hashBookingActionToken("token-one"), firstToken],
      [hashBookingActionToken("token-two"), secondToken],
    ]);
    const api = createBookingManagementApi({
      findManageToken: async (tokenHash) => tokenMap.get(tokenHash) ?? null,
      getBookingPolicySettings: async () => ({ cancellationHours: 48, minAdvanceHours: 2, maxAdvanceDays: 90 }),
      getPublicBookingCatalog: async () => ({ slots: [] }),
      issueCancellationUrl: async (bookingId) => `https://example.com/cancel/${bookingId}`,
      rescheduleBooking: async () => {
        throw new Error("rescheduleBooking should not be called");
      },
    });

    const firstResult = await api.getPublicBookingManagementPageState("token-one");
    const secondResult = await api.getPublicBookingManagementPageState("token-two");

    assert.equal(firstResult.status, "ready");
    assert.equal(secondResult.status, "ready");
    if (firstResult.status === "ready" && secondResult.status === "ready") {
      assert.equal(firstResult.bookingId, "booking-1");
      assert.equal(secondResult.bookingId, "booking-2");
      assert.notEqual(firstResult.bookingId, secondResult.bookingId);
    }
  });

  test("does not expose cancelled bookings through public token management", async () => {
    const { resolvePublicBookingManagementState } = await import("./booking-management");

    const result = resolvePublicBookingManagementState(
      buildToken({ bookingStatus: "CANCELLED" }),
      48,
    );

    assert.equal(result.status, "already_cancelled");
    assert.match(result.message, /už byla zrušena/i);
  });

  test("does not expose completed or no-show bookings through public token management", async () => {
    const { resolvePublicBookingManagementState } = await import("./booking-management");

    const completed = resolvePublicBookingManagementState(buildToken({ bookingStatus: "COMPLETED" }), 48);
    const noShow = resolvePublicBookingManagementState(buildToken({ bookingStatus: "NO_SHOW" }), 48);

    assert.equal(completed.status, "not_reschedulable");
    assert.match(completed.message, /už nelze měnit online/i);
    assert.equal(noShow.status, "not_reschedulable");
    assert.match(noShow.message, /už nelze měnit online/i);
  });
});

describe("state validation", () => {
  test("allows confirmed booking to stay reschedulable when all rules pass", async () => {
    const { resolvePublicBookingManagementState } = await import("./booking-management");

    const result = resolvePublicBookingManagementState(
      buildToken({ bookingStatus: "CONFIRMED" }),
      48,
    );

    assert.equal(result.status, "ready");
  });

  test("allows pending booking to stay reschedulable when all rules pass", async () => {
    const { resolvePublicBookingManagementState } = await import("./booking-management");

    const result = resolvePublicBookingManagementState(
      buildToken({ bookingStatus: "PENDING" }),
      48,
    );

    assert.equal(result.status, "ready");
  });

  test("rejects cancelled booking state", async () => {
    const { resolvePublicBookingManagementState } = await import("./booking-management");

    const result = resolvePublicBookingManagementState(
      buildToken({ bookingStatus: "CANCELLED" }),
      48,
    );

    assert.equal(result.status, "already_cancelled");
  });

  test("rejects completed booking state", async () => {
    const { resolvePublicBookingManagementState } = await import("./booking-management");

    const result = resolvePublicBookingManagementState(
      buildToken({ bookingStatus: "COMPLETED" }),
      48,
    );

    assert.equal(result.status, "not_reschedulable");
  });

  test("rejects no-show booking state", async () => {
    const { resolvePublicBookingManagementState } = await import("./booking-management");

    const result = resolvePublicBookingManagementState(
      buildToken({ bookingStatus: "NO_SHOW" }),
      48,
    );

    assert.equal(result.status, "not_reschedulable");
  });

  test("blocks public reschedule when booking is inside the online cancellation window", async () => {
    const { resolvePublicBookingManagementState } = await import("./booking-management");

    const result = resolvePublicBookingManagementState(
      buildToken({ scheduledStartsAt: new Date(Date.now() + 12 * 60 * 60 * 1000) }),
      24,
    );

    assert.equal(result.status, "not_reschedulable");
    assert.match(result.message, /méně než 24 hodin/i);
  });
});

describe("reschedule booking", () => {
  test("reschedules booking through valid token and forwards only the matched booking id", async () => {
    const { createBookingManagementApi } = await import("./booking-management");
    const rescheduleCalls: Array<Record<string, unknown>> = [];
    const api = createBookingManagementApi({
      findManageToken: async () => buildToken({ bookingId: "booking-1" }),
      getBookingPolicySettings: async () => ({ cancellationHours: 48, minAdvanceHours: 2, maxAdvanceDays: 90 }),
      getPublicBookingCatalog: async () => ({ slots: [] }),
      issueCancellationUrl: async () => "https://example.com/cancel/booking-1",
      rescheduleBooking: async (input) => {
        rescheduleCalls.push(input as Record<string, unknown>);
        return {
          bookingId: "booking-1",
          scheduledStartsAt: "2026-04-28T09:00:00.000Z",
          scheduledEndsAt: "2026-04-28T10:00:00.000Z",
          scheduledAtLabel: "Po 28. 4. 2026 09:00-10:00",
          previousScheduledAtLabel: "So 26. 4. 2026 09:00-10:00",
          rescheduleCount: 1,
          manualOverride: false,
          notificationStatus: "logged",
        };
      },
    });

    const result = await api.reschedulePublicBookingByToken({
      token: "valid-token",
      slotId: "slot-2",
      newStartAt: "2026-04-28T09:00:00.000Z",
      expectedUpdatedAt: "2026-04-23T09:00:00.000Z",
    });

    assert.equal(result.status, "rescheduled");
    assert.equal(rescheduleCalls.length, 1);
    assert.deepEqual(rescheduleCalls[0], {
      bookingId: "booking-1",
      slotId: "slot-2",
      newStartAt: "2026-04-28T09:00:00.000Z",
      changedByUserId: null,
      changedByClient: true,
      notifyClient: true,
      includeCalendarAttachment: true,
      expectedUpdatedAt: "2026-04-23T09:00:00.000Z",
    });
  });

  test("rejects reschedule when token is invalid and never calls reschedule service", async () => {
    const { createBookingManagementApi } = await import("./booking-management");
    let rescheduleCalled = false;
    const api = createBookingManagementApi({
      findManageToken: async () => null,
      getBookingPolicySettings: async () => ({ cancellationHours: 48, minAdvanceHours: 2, maxAdvanceDays: 90 }),
      getPublicBookingCatalog: async () => ({ slots: [] }),
      issueCancellationUrl: async () => "https://example.com/cancel/booking-1",
      rescheduleBooking: async () => {
        rescheduleCalled = true;
        throw new Error("rescheduleBooking should not be called");
      },
    });

    const result = await api.reschedulePublicBookingByToken({
      token: "missing-token",
      slotId: "slot-2",
      newStartAt: "2026-04-28T09:00:00.000Z",
      expectedUpdatedAt: "2026-04-23T09:00:00.000Z",
    });

    assert.equal(result.status, "invalid");
    assert.equal(rescheduleCalled, false);
  });

  test("rejects reschedule when booking is no longer eligible for public changes", async () => {
    const { createBookingManagementApi } = await import("./booking-management");
    let rescheduleCalled = false;
    const api = createBookingManagementApi({
      findManageToken: async () => buildToken({ bookingStatus: "NO_SHOW" }),
      getBookingPolicySettings: async () => ({ cancellationHours: 48, minAdvanceHours: 2, maxAdvanceDays: 90 }),
      getPublicBookingCatalog: async () => ({ slots: [] }),
      issueCancellationUrl: async () => "https://example.com/cancel/booking-1",
      rescheduleBooking: async () => {
        rescheduleCalled = true;
        throw new Error("rescheduleBooking should not be called");
      },
    });

    const result = await api.reschedulePublicBookingByToken({
      token: "valid-token",
      slotId: "slot-2",
      newStartAt: "2026-04-28T09:00:00.000Z",
      expectedUpdatedAt: "2026-04-23T09:00:00.000Z",
    });

    assert.equal(result.status, "not_reschedulable");
    assert.equal(rescheduleCalled, false);
  });
});

describe("error handling", () => {
  test("returns safe invalid response for wrong token type", async () => {
    const { resolvePublicBookingManagementState } = await import("./booking-management");

    const result = resolvePublicBookingManagementState(
      buildToken({ type: "CANCEL" }),
      48,
    );

    assert.equal(result.status, "invalid");
    assert.match(result.message, /neslouží pro správu rezervace/i);
  });

  test("returns expired response for expired token", async () => {
    const { resolvePublicBookingManagementState } = await import("./booking-management");

    const result = resolvePublicBookingManagementState(
      buildToken({ expiresAt: new Date(Date.now() - 60 * 1000) }),
      48,
    );

    assert.equal(result.status, "expired");
    assert.match(result.message, /platnost odkazu už vypršela/i);
  });

  test("returns safe invalid response for used or revoked token", async () => {
    const { resolvePublicBookingManagementState } = await import("./booking-management");

    const used = resolvePublicBookingManagementState(
      buildToken({ usedAt: new Date("2026-04-23T09:30:00.000Z") }),
      48,
    );
    const revoked = resolvePublicBookingManagementState(
      buildToken({ revokedAt: new Date("2026-04-23T09:30:00.000Z") }),
      48,
    );

    assert.equal(used.status, "invalid");
    assert.match(used.message, /už není aktivní/i);
    assert.equal(revoked.status, "invalid");
    assert.match(revoked.message, /už není aktivní/i);
  });
});
