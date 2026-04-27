import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingStatus,
} from "@prisma/client";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

function buildSlot(overrides: Partial<{
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: AvailabilitySlotStatus;
  serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
  allowedServices: Array<{ serviceId: string }>;
}> = {}) {
  return {
    id: overrides.id ?? "slot-current",
    startsAt: overrides.startsAt ?? new Date("2026-04-26T09:00:00.000Z"),
    endsAt: overrides.endsAt ?? new Date("2026-04-26T10:00:00.000Z"),
    capacity: overrides.capacity ?? 1,
    status: overrides.status ?? AvailabilitySlotStatus.PUBLISHED,
    serviceRestrictionMode:
      overrides.serviceRestrictionMode ?? AvailabilitySlotServiceRestrictionMode.ANY,
    publicNote: null,
    internalNote: null,
    publishedAt: new Date("2026-04-20T09:00:00.000Z"),
    cancelledAt: null,
    createdByUserId: null,
    allowedServices: overrides.allowedServices ?? [],
  };
}

function buildBooking(overrides: Partial<{
  id: string;
  status: BookingStatus;
  slotId: string;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
  serviceDurationMinutes: number;
  updatedAt: Date;
  slot: ReturnType<typeof buildSlot>;
  manualOverride: boolean;
  rescheduleCount: number;
  clientEmailSnapshot: string;
}> = {}) {
  const scheduledStartsAt = overrides.scheduledStartsAt ?? new Date("2026-04-26T09:00:00.000Z");
  const scheduledEndsAt =
    overrides.scheduledEndsAt ?? new Date(scheduledStartsAt.getTime() + 60 * 60 * 1000);
  const slot = overrides.slot ?? buildSlot({
    id: overrides.slotId ?? "slot-current",
    startsAt: scheduledStartsAt,
    endsAt: scheduledEndsAt,
  });

  return {
    id: overrides.id ?? "booking-1",
    status: overrides.status ?? BookingStatus.CONFIRMED,
    slotId: overrides.slotId ?? slot.id,
    serviceId: "service-1",
    serviceDurationMinutes: overrides.serviceDurationMinutes ?? 60,
    serviceNameSnapshot: "Lash lifting",
    scheduledStartsAt,
    scheduledEndsAt,
    clientId: "client-1",
    clientNameSnapshot: "Jana Nováková",
    clientEmailSnapshot: overrides.clientEmailSnapshot ?? "jana@example.com",
    clientPhoneSnapshot: "+420777000000",
    clientNote: null,
    manualOverride: overrides.manualOverride ?? false,
    updatedAt: overrides.updatedAt ?? new Date("2026-04-23T09:00:00.000Z"),
    rescheduleCount: overrides.rescheduleCount ?? 0,
    slot,
  };
}

async function createHarness(overrides: Partial<{
  booking: ReturnType<typeof buildBooking> | null;
  requestedSlot: ReturnType<typeof buildSlot> | null;
  overlappingSlots: Array<ReturnType<typeof buildSlot>>;
  activeBookingCount: number;
  withinWindow: boolean;
  notificationStatus: "queued" | "logged";
}> = {}) {
  const { createBookingReschedulingApi } = await import("./booking-rescheduling");

  const booking = overrides.booking === undefined ? buildBooking() : overrides.booking;
  const requestedSlot = overrides.requestedSlot === undefined
    ? buildSlot({
        id: "slot-new",
        startsAt: new Date("2026-04-28T09:00:00.000Z"),
        endsAt: new Date("2026-04-28T10:00:00.000Z"),
      })
    : overrides.requestedSlot;

  const calls = {
    bookingUpdate: [] as Array<Record<string, unknown>>,
    bookingCount: [] as Array<Record<string, unknown>>,
    logCreate: [] as Array<Record<string, unknown>>,
    slotCreate: [] as Array<Record<string, unknown>>,
    slotUpdate: [] as Array<Record<string, unknown>>,
    slotDelete: [] as Array<Record<string, unknown>>,
    notification: [] as Array<Record<string, unknown>>,
  };

  let queryRawCalls = 0;
  const tx = {
    $queryRaw: async () => {
      queryRawCalls += 1;

      if (queryRawCalls === 1) {
        return booking ? [{ id: booking.id }] : [];
      }

      return requestedSlot ? [{ id: requestedSlot.id }] : [];
    },
    booking: {
      findUnique: async () => booking,
      count: async (input: Record<string, unknown>) => {
        calls.bookingCount.push(input);
        return overrides.activeBookingCount ?? 0;
      },
      update: async (input: Record<string, unknown>) => {
        calls.bookingUpdate.push(input);
        return {};
      },
    },
    availabilitySlot: {
      findUnique: async () => requestedSlot,
      findMany: async () => overrides.overlappingSlots ?? [],
      create: async (input: Record<string, unknown>) => {
        calls.slotCreate.push(input);
        return buildSlot({
          id: "slot-manual",
          startsAt: new Date("2026-04-28T09:00:00.000Z"),
          endsAt: new Date("2026-04-28T10:00:00.000Z"),
          status: AvailabilitySlotStatus.DRAFT,
        });
      },
      update: async (input: Record<string, unknown>) => {
        calls.slotUpdate.push(input);
        return {};
      },
      delete: async (input: Record<string, unknown>) => {
        calls.slotDelete.push(input);
        return {};
      },
    },
    bookingRescheduleLog: {
      create: async (input: Record<string, unknown>) => {
        calls.logCreate.push(input);
        return {};
      },
    },
  };

  const api = createBookingReschedulingApi({
    prisma: {
      $transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    } as never,
    getBookingPolicySettings: async () => ({
      minAdvanceHours: 2,
      maxAdvanceDays: 90,
      cancellationHours: 48,
    }),
    isBookingWithinWindow: () => overrides.withinWindow ?? true,
    queueBookingRescheduledNotification: async (input) => {
      calls.notification.push(input as Record<string, unknown>);
      return overrides.notificationStatus ?? "logged";
    },
  });

  return {
    api,
    booking,
    requestedSlot,
    calls,
  };
}

function expectRescheduleErrorCode(
  error: unknown,
  expectedCode: string,
) {
  assert.equal(typeof error, "object");
  assert.ok(error);
  const typedError = error as Record<string, unknown>;
  assert.equal("code" in typedError, true);
  assert.equal((typedError as { code: string }).code, expectedCode);
}

describe("state validation", () => {
  test("allows confirmed booking to be rescheduled when the new slot is available", async () => {
    const harness = await createHarness({
      booking: buildBooking({ status: BookingStatus.CONFIRMED }),
    });

    const result = await harness.api.rescheduleBooking({
      bookingId: "booking-1",
      slotId: "slot-new",
      newStartAt: "2026-04-28T09:00:00.000Z",
      changedByUserId: null,
      changedByClient: true,
      notifyClient: true,
      expectedUpdatedAt: "2026-04-23T09:00:00.000Z",
    });

    assert.equal(result.bookingId, "booking-1");
  });

  test("allows pending booking to be rescheduled when the new slot is available", async () => {
    const harness = await createHarness({
      booking: buildBooking({ status: BookingStatus.PENDING }),
    });

    const result = await harness.api.rescheduleBooking({
      bookingId: "booking-1",
      slotId: "slot-new",
      newStartAt: "2026-04-28T09:00:00.000Z",
      changedByUserId: null,
      changedByClient: true,
      notifyClient: false,
      expectedUpdatedAt: "2026-04-23T09:00:00.000Z",
    });

    assert.equal(result.bookingId, "booking-1");
    assert.equal(result.notificationStatus, "skipped");
  });

  test("allows reschedule across adjacent published slots and uses the whole chain in conflict checks", async () => {
    const harness = await createHarness({
      booking: buildBooking({
        serviceDurationMinutes: 120,
      }),
      requestedSlot: buildSlot({
        id: "slot-new",
        startsAt: new Date("2026-04-28T09:30:00.000Z"),
        endsAt: new Date("2026-04-28T10:00:00.000Z"),
      }),
      overlappingSlots: [
        buildSlot({
          id: "slot-follow-up",
          startsAt: new Date("2026-04-28T10:00:00.000Z"),
          endsAt: new Date("2026-04-28T11:30:00.000Z"),
        }),
      ],
    });

    const result = await harness.api.rescheduleBooking({
      bookingId: "booking-1",
      slotId: "slot-new",
      newStartAt: "2026-04-28T09:30:00.000Z",
      changedByUserId: null,
      changedByClient: true,
      notifyClient: false,
      expectedUpdatedAt: "2026-04-23T09:00:00.000Z",
    });

    assert.equal(result.bookingId, "booking-1");
    assert.deepEqual(harness.calls.bookingCount[0], {
      where: {
        id: {
          not: "booking-1",
        },
        status: {
          in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        },
        scheduledStartsAt: {
          lt: new Date("2026-04-28T11:30:00.000Z"),
        },
        scheduledEndsAt: {
          gt: new Date("2026-04-28T09:30:00.000Z"),
        },
        slotId: {
          in: ["slot-new", "slot-follow-up"],
        },
      },
    });
  });

  test("rejects reschedule when booking is cancelled", async () => {
    const { bookingRescheduleErrorCodes } = await import("./booking-rescheduling");
    const harness = await createHarness({
      booking: buildBooking({ status: BookingStatus.CANCELLED }),
    });

    await assert.rejects(
      harness.api.rescheduleBooking({
        bookingId: "booking-1",
        slotId: "slot-new",
        newStartAt: "2026-04-28T09:00:00.000Z",
        changedByUserId: null,
        changedByClient: true,
        notifyClient: true,
      }),
      (error) => {
        expectRescheduleErrorCode(error, bookingRescheduleErrorCodes.statusNotAllowed);
        return true;
      },
    );
  });

  test("rejects reschedule when booking is completed", async () => {
    const { bookingRescheduleErrorCodes } = await import("./booking-rescheduling");
    const harness = await createHarness({
      booking: buildBooking({ status: BookingStatus.COMPLETED }),
    });

    await assert.rejects(
      harness.api.rescheduleBooking({
        bookingId: "booking-1",
        slotId: "slot-new",
        newStartAt: "2026-04-28T09:00:00.000Z",
        changedByUserId: null,
        changedByClient: true,
        notifyClient: true,
      }),
      (error) => {
        expectRescheduleErrorCode(error, bookingRescheduleErrorCodes.statusNotAllowed);
        return true;
      },
    );
  });

  test("rejects reschedule when booking is marked as no-show", async () => {
    const { bookingRescheduleErrorCodes } = await import("./booking-rescheduling");
    const harness = await createHarness({
      booking: buildBooking({ status: BookingStatus.NO_SHOW }),
    });

    await assert.rejects(
      harness.api.rescheduleBooking({
        bookingId: "booking-1",
        slotId: "slot-new",
        newStartAt: "2026-04-28T09:00:00.000Z",
        changedByUserId: null,
        changedByClient: true,
        notifyClient: true,
      }),
      (error) => {
        expectRescheduleErrorCode(error, bookingRescheduleErrorCodes.statusNotAllowed);
        return true;
      },
    );
  });
});

describe("reschedule booking", () => {
  test("reschedules to a new available slot and returns the updated booking result", async () => {
    const harness = await createHarness();

    const result = await harness.api.rescheduleBooking({
      bookingId: "booking-1",
      slotId: "slot-new",
      newStartAt: "2026-04-28T09:00:00.000Z",
      changedByUserId: null,
      changedByClient: true,
      notifyClient: true,
      includeCalendarAttachment: true,
      expectedUpdatedAt: "2026-04-23T09:00:00.000Z",
    });

    assert.equal(result.bookingId, "booking-1");
    assert.equal(result.scheduledStartsAt, "2026-04-28T09:00:00.000Z");
    assert.equal(result.scheduledEndsAt, "2026-04-28T10:00:00.000Z");
    assert.equal(result.notificationStatus, "logged");
    assert.equal(harness.calls.bookingUpdate.length, 1);
  });

  test("rejects reschedule when the new term is the same as the current one", async () => {
    const { bookingRescheduleErrorCodes } = await import("./booking-rescheduling");
    const harness = await createHarness({
      booking: buildBooking(),
      requestedSlot: buildSlot({
        id: "slot-current",
        startsAt: new Date("2026-04-26T09:00:00.000Z"),
        endsAt: new Date("2026-04-26T10:00:00.000Z"),
      }),
    });

    await assert.rejects(
      harness.api.rescheduleBooking({
        bookingId: "booking-1",
        slotId: "slot-current",
        newStartAt: "2026-04-26T09:00:00.000Z",
        changedByUserId: null,
        changedByClient: true,
        notifyClient: true,
      }),
      (error) => {
        expectRescheduleErrorCode(error, bookingRescheduleErrorCodes.sameTerm);
        return true;
      },
    );

    assert.equal(harness.calls.bookingUpdate.length, 0);
    assert.equal(harness.calls.logCreate.length, 0);
    assert.equal(harness.calls.notification.length, 0);
  });

  test("rejects reschedule when the new slot collides with another active booking", async () => {
    const { bookingRescheduleErrorCodes } = await import("./booking-rescheduling");
    const harness = await createHarness({
      activeBookingCount: 1,
    });

    await assert.rejects(
      harness.api.rescheduleBooking({
        bookingId: "booking-1",
        slotId: "slot-new",
        newStartAt: "2026-04-28T09:00:00.000Z",
        changedByUserId: null,
        changedByClient: true,
        notifyClient: true,
      }),
      (error) => {
        expectRescheduleErrorCode(error, bookingRescheduleErrorCodes.conflict);
        return true;
      },
    );

    assert.equal(harness.calls.bookingUpdate.length, 0);
    assert.equal(harness.calls.logCreate.length, 0);
    assert.equal(harness.calls.notification.length, 0);
  });

  test("rejects reschedule when the selected slot is shorter than the service duration", async () => {
    const { bookingRescheduleErrorCodes } = await import("./booking-rescheduling");
    const harness = await createHarness({
      requestedSlot: buildSlot({
        id: "slot-short",
        startsAt: new Date("2026-04-28T09:00:00.000Z"),
        endsAt: new Date("2026-04-28T09:30:00.000Z"),
      }),
    });

    await assert.rejects(
      harness.api.rescheduleBooking({
        bookingId: "booking-1",
        slotId: "slot-short",
        newStartAt: "2026-04-28T09:00:00.000Z",
        changedByUserId: null,
        changedByClient: true,
        notifyClient: true,
      }),
      (error) => {
        expectRescheduleErrorCode(error, bookingRescheduleErrorCodes.slotTooShort);
        return true;
      },
    );

    assert.equal(harness.calls.bookingUpdate.length, 0);
  });

  test("rejects reschedule when expected updatedAt does not match", async () => {
    const { bookingRescheduleErrorCodes } = await import("./booking-rescheduling");
    const harness = await createHarness();

    await assert.rejects(
      harness.api.rescheduleBooking({
        bookingId: "booking-1",
        slotId: "slot-new",
        newStartAt: "2026-04-28T09:00:00.000Z",
        changedByUserId: null,
        changedByClient: true,
        notifyClient: true,
        expectedUpdatedAt: "2026-04-23T08:59:59.000Z",
      }),
      (error) => {
        expectRescheduleErrorCode(error, bookingRescheduleErrorCodes.concurrentModification);
        return true;
      },
    );

    assert.equal(harness.calls.bookingUpdate.length, 0);
    assert.equal(harness.calls.logCreate.length, 0);
  });
});

describe("history and side effects", () => {
  test("writes reschedule log with client-originated metadata and triggers notification on success", async () => {
    const harness = await createHarness();

    await harness.api.rescheduleBooking({
      bookingId: "booking-1",
      slotId: "slot-new",
      newStartAt: "2026-04-28T09:00:00.000Z",
      changedByUserId: null,
      changedByClient: true,
      notifyClient: true,
      includeCalendarAttachment: true,
      expectedUpdatedAt: "2026-04-23T09:00:00.000Z",
    });

    assert.equal(harness.calls.logCreate.length, 1);
    assert.deepEqual(harness.calls.logCreate[0], {
      data: {
        bookingId: "booking-1",
        oldStartAt: new Date("2026-04-26T09:00:00.000Z"),
        oldEndAt: new Date("2026-04-26T10:00:00.000Z"),
        newStartAt: new Date("2026-04-28T09:00:00.000Z"),
        newEndAt: new Date("2026-04-28T10:00:00.000Z"),
        changedByUserId: null,
        changedByClient: true,
        reason: null,
      },
    });
    assert.equal(harness.calls.notification.length, 1);
    assert.deepEqual(harness.calls.notification[0], {
      bookingId: "booking-1",
      clientId: "client-1",
      clientEmail: "jana@example.com",
      clientName: "Jana Nováková",
      serviceName: "Lash lifting",
      previousStartsAt: new Date("2026-04-26T09:00:00.000Z"),
      previousEndsAt: new Date("2026-04-26T10:00:00.000Z"),
      scheduledStartsAt: new Date("2026-04-28T09:00:00.000Z"),
      scheduledEndsAt: new Date("2026-04-28T10:00:00.000Z"),
      includeCalendarAttachment: true,
    });
  });

  test("does not write history or enqueue notification when reschedule fails", async () => {
    const { bookingRescheduleErrorCodes } = await import("./booking-rescheduling");
    const harness = await createHarness({
      activeBookingCount: 1,
    });

    await assert.rejects(
      harness.api.rescheduleBooking({
        bookingId: "booking-1",
        slotId: "slot-new",
        newStartAt: "2026-04-28T09:00:00.000Z",
        changedByUserId: null,
        changedByClient: true,
        notifyClient: true,
      }),
      (error) => {
        expectRescheduleErrorCode(error, bookingRescheduleErrorCodes.conflict);
        return true;
      },
    );

    assert.equal(harness.calls.logCreate.length, 0);
    assert.equal(harness.calls.notification.length, 0);
  });
});

describe("error handling", () => {
  test("returns not found business error when booking does not exist", async () => {
    const { bookingRescheduleErrorCodes } = await import("./booking-rescheduling");
    const harness = await createHarness({
      booking: null,
    });

    await assert.rejects(
      harness.api.rescheduleBooking({
        bookingId: "missing-booking",
        slotId: "slot-new",
        newStartAt: "2026-04-28T09:00:00.000Z",
        changedByUserId: null,
        changedByClient: true,
        notifyClient: true,
      }),
      (error) => {
        expectRescheduleErrorCode(error, bookingRescheduleErrorCodes.notFound);
        return true;
      },
    );
  });

  test("returns invalid date time business error when new start time is missing or invalid", async () => {
    const { bookingRescheduleErrorCodes } = await import("./booking-rescheduling");
    const harness = await createHarness();

    await assert.rejects(
      harness.api.rescheduleBooking({
        bookingId: "booking-1",
        slotId: "slot-new",
        newStartAt: "",
        changedByUserId: null,
        changedByClient: true,
        notifyClient: true,
      }),
      (error) => {
        expectRescheduleErrorCode(error, bookingRescheduleErrorCodes.invalidDateTime);
        return true;
      },
    );
  });

  test("returns invalid date time business error when new end time breaks service duration", async () => {
    const { bookingRescheduleErrorCodes } = await import("./booking-rescheduling");
    const harness = await createHarness();

    await assert.rejects(
      harness.api.rescheduleBooking({
        bookingId: "booking-1",
        slotId: "slot-new",
        newStartAt: "2026-04-28T09:00:00.000Z",
        newEndAt: "2026-04-28T09:45:00.000Z",
        changedByUserId: null,
        changedByClient: true,
        notifyClient: true,
      }),
      (error) => {
        expectRescheduleErrorCode(error, bookingRescheduleErrorCodes.invalidDateTime);
        return true;
      },
    );
  });
});
