import assert from "node:assert/strict";
import test from "node:test";

import { AvailabilitySlotStatus } from "@/generated/prisma/browser";

import { getRestorableSlotEnd } from "./booking-slot-compaction";

test("storno obnoví úklid uvnitř původně vypsané dostupnosti", () => {
  const serviceEnd = new Date("2026-08-31T09:30:00.000Z");
  const originalAvailabilityEnd = new Date("2026-08-31T10:00:00.000Z");

  assert.deepEqual(
    getRestorableSlotEnd(serviceEnd, [{ originalAvailabilityEndsAt: originalAvailabilityEnd }]),
    originalAvailabilityEnd,
  );
});

test("storno nezveřejní úklid mimo původní dostupnost", () => {
  const serviceEnd = new Date("2026-08-31T15:00:00.000Z");

  assert.deepEqual(
    getRestorableSlotEnd(serviceEnd, [{ originalAvailabilityEndsAt: serviceEnd }]),
    serviceEnd,
  );
});

test("společná obnova pro uživatelské i admin storno nevymyslí pokračování bez původní dostupnosti", async () => {
  const startsAt = new Date("2026-08-31T09:00:00.000Z");
  const sourceEndsAt = new Date("2026-08-31T09:30:00.000Z");
  const scheduledStartsAt = new Date("2026-08-31T09:15:00.000Z");
  const scheduledEndsAt = new Date("2026-08-31T10:00:00.000Z");
  const created: unknown[] = [];
  const updated: unknown[] = [];
  const tx = {
    availabilitySlot: {
      findFirst: async () => ({
        id: "archived-source",
        startsAt,
        endsAt: sourceEndsAt,
        status: AvailabilitySlotStatus.ARCHIVED,
        capacity: 1,
        publicNote: null,
        internalNote: null,
        serviceRestrictionMode: "ANY",
        publishedAt: startsAt,
        cancelledAt: null,
        createdByUserId: "owner-1",
        allowedServices: [],
        bookings: [],
      }),
      findMany: async () => [],
      create: async (args: unknown) => { created.push(args); },
      update: async (args: unknown) => { updated.push(args); },
    },
    booking: { count: async () => 0 },
  } as never;
  const { restoreArchivedBookingServiceSlotAfterCancellation } = await import("./booking-slot-compaction");

  await restoreArchivedBookingServiceSlotAfterCancellation(
    tx,
    "archived-source",
    scheduledStartsAt,
    scheduledEndsAt,
    null,
    "service-1",
    new Date("2026-08-31T10:30:00.000Z"),
  );

  assert.deepEqual(created, []);
  assert.deepEqual(updated, []);
});

test("společná obnova storna ponechá překrývající DRAFT blokaci a nevytvoří publikovaný termín", async () => {
  const startsAt = new Date("2026-08-31T09:00:00.000Z");
  const sourceEndsAt = new Date("2026-08-31T11:00:00.000Z");
  const scheduledStartsAt = new Date("2026-08-31T09:30:00.000Z");
  const scheduledEndsAt = new Date("2026-08-31T10:00:00.000Z");
  const blockedStartsAt = new Date("2026-08-31T10:15:00.000Z");
  const blockedEndsAt = new Date("2026-08-31T10:45:00.000Z");
  const created: unknown[] = [];
  const updated: unknown[] = [];
  const tx = {
    availabilitySlot: {
      findFirst: async () => ({
        id: "archived-source",
        startsAt,
        endsAt: sourceEndsAt,
        status: AvailabilitySlotStatus.ARCHIVED,
        capacity: 1,
        publicNote: null,
        internalNote: null,
        serviceRestrictionMode: "ANY",
        publishedAt: startsAt,
        cancelledAt: null,
        createdByUserId: "owner-1",
        allowedServices: [],
        bookings: [],
      }),
      findMany: async () => [{
        startsAt: blockedStartsAt,
        endsAt: blockedEndsAt,
        status: AvailabilitySlotStatus.DRAFT,
      }],
      create: async (args: unknown) => { created.push(args); },
      update: async (args: unknown) => { updated.push(args); },
    },
    booking: { count: async () => 0 },
  } as never;
  const { restoreArchivedBookingServiceSlotAfterCancellation } = await import("./booking-slot-compaction");

  await restoreArchivedBookingServiceSlotAfterCancellation(
    tx,
    "archived-source",
    scheduledStartsAt,
    scheduledEndsAt,
    sourceEndsAt,
    "service-1",
    sourceEndsAt,
  );

  assert.deepEqual(created, []);
  assert.deepEqual(updated, []);
});
