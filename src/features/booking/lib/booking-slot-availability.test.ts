import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
} from "@prisma/client";

import {
  buildMergedPublicCatalogSlots,
  resolvePublishedSlotCoverage,
} from "./booking-slot-availability";
import { buildSlotTimeOptions } from "./booking-time-slots";

describe("buildMergedPublicCatalogSlots", () => {
  test("merges adjacent compatible slots and keeps source segments", () => {
    const slots = buildMergedPublicCatalogSlots(
      [
        {
          id: "slot-1",
          startsAt: new Date("2026-04-27T11:00:00.000Z"),
          endsAt: new Date("2026-04-27T11:30:00.000Z"),
          publicNote: null,
          capacity: 1,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServiceIds: [],
        },
        {
          id: "slot-2",
          startsAt: new Date("2026-04-27T11:30:00.000Z"),
          endsAt: new Date("2026-04-27T12:00:00.000Z"),
          publicNote: null,
          capacity: 1,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServiceIds: [],
        },
        {
          id: "slot-3",
          startsAt: new Date("2026-04-27T12:00:00.000Z"),
          endsAt: new Date("2026-04-27T13:30:00.000Z"),
          publicNote: null,
          capacity: 1,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServiceIds: [],
        },
      ],
      [{
        startsAt: new Date("2026-04-27T12:15:00.000Z"),
        endsAt: new Date("2026-04-27T12:45:00.000Z"),
      }],
    );

    assert.equal(slots.length, 1);
    assert.equal(slots[0]?.startsAt, "2026-04-27T11:00:00.000Z");
    assert.equal(slots[0]?.endsAt, "2026-04-27T13:30:00.000Z");
    assert.deepEqual(slots[0]?.segments?.map((segment) => segment.id), ["slot-1", "slot-2", "slot-3"]);
    assert.equal(slots[0]?.bookedIntervals.length, 1);
  });
});

describe("buildSlotTimeOptions", () => {
  test("uses the segment that contains the selected start as slotId", () => {
    const [mergedSlot] = buildMergedPublicCatalogSlots(
      [
        {
          id: "slot-1",
          startsAt: new Date("2026-04-27T11:00:00.000Z"),
          endsAt: new Date("2026-04-27T11:30:00.000Z"),
          publicNote: null,
          capacity: 1,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServiceIds: [],
        },
        {
          id: "slot-2",
          startsAt: new Date("2026-04-27T11:30:00.000Z"),
          endsAt: new Date("2026-04-27T12:00:00.000Z"),
          publicNote: null,
          capacity: 1,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServiceIds: [],
        },
        {
          id: "slot-3",
          startsAt: new Date("2026-04-27T12:00:00.000Z"),
          endsAt: new Date("2026-04-27T13:30:00.000Z"),
          publicNote: null,
          capacity: 1,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServiceIds: [],
        },
      ],
      [],
    );

    assert.ok(mergedSlot);

    const options = buildSlotTimeOptions(mergedSlot, 120);
    const targetOption = options.find((option) => option.startsAt === "2026-04-27T11:30:00.000Z");

    assert.equal(targetOption?.slotId, "slot-2");
  });
});

describe("resolvePublishedSlotCoverage", () => {
  test("accepts a continuous chain of published slots", () => {
    const coverage = resolvePublishedSlotCoverage(
      [
        {
          id: "slot-1",
          startsAt: new Date("2026-04-27T11:00:00.000Z"),
          endsAt: new Date("2026-04-27T11:30:00.000Z"),
          capacity: 1,
          status: AvailabilitySlotStatus.PUBLISHED,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServices: [],
        },
        {
          id: "slot-2",
          startsAt: new Date("2026-04-27T11:30:00.000Z"),
          endsAt: new Date("2026-04-27T12:00:00.000Z"),
          capacity: 1,
          status: AvailabilitySlotStatus.PUBLISHED,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServices: [],
        },
        {
          id: "slot-3",
          startsAt: new Date("2026-04-27T12:00:00.000Z"),
          endsAt: new Date("2026-04-27T13:30:00.000Z"),
          capacity: 1,
          status: AvailabilitySlotStatus.PUBLISHED,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServices: [],
        },
      ],
      "service-1",
      new Date("2026-04-27T11:30:00.000Z"),
      new Date("2026-04-27T13:30:00.000Z"),
      "slot-2",
    );

    assert.deepEqual(coverage?.coverage.map((slot) => slot.id), ["slot-2", "slot-3"]);
  });

  test("rejects a gap between slots", () => {
    const coverage = resolvePublishedSlotCoverage(
      [
        {
          id: "slot-1",
          startsAt: new Date("2026-04-27T11:30:00.000Z"),
          endsAt: new Date("2026-04-27T12:00:00.000Z"),
          capacity: 1,
          status: AvailabilitySlotStatus.PUBLISHED,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServices: [],
        },
        {
          id: "slot-2",
          startsAt: new Date("2026-04-27T12:30:00.000Z"),
          endsAt: new Date("2026-04-27T13:30:00.000Z"),
          capacity: 1,
          status: AvailabilitySlotStatus.PUBLISHED,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServices: [],
        },
      ],
      "service-1",
      new Date("2026-04-27T11:30:00.000Z"),
      new Date("2026-04-27T13:30:00.000Z"),
      "slot-1",
    );

    assert.equal(coverage, null);
  });
});
