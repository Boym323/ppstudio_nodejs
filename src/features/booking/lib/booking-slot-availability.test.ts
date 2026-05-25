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

  test("returns UTC ISO instants that clients can render as Prague salon time", () => {
    const [winterSlot, summerSlot] = buildMergedPublicCatalogSlots(
      [
        {
          id: "winter-slot",
          startsAt: new Date("2026-01-15T08:00:00.000Z"),
          endsAt: new Date("2026-01-15T09:00:00.000Z"),
          publicNote: null,
          capacity: 1,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServiceIds: [],
        },
        {
          id: "summer-slot",
          startsAt: new Date("2026-07-15T07:00:00.000Z"),
          endsAt: new Date("2026-07-15T08:00:00.000Z"),
          publicNote: null,
          capacity: 1,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServiceIds: [],
        },
      ],
      [],
    );

    assert.equal(winterSlot?.startsAt, "2026-01-15T08:00:00.000Z");
    assert.equal(winterSlot?.endsAt, "2026-01-15T09:00:00.000Z");
    assert.equal(summerSlot?.startsAt, "2026-07-15T07:00:00.000Z");
    assert.equal(summerSlot?.endsAt, "2026-07-15T08:00:00.000Z");
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

describe("buildSlotTimeOptions cleanup blocking", () => {
  function buildCatalogSlot(bookedInterval: { startsAt: string; endsAt: string }) {
    return {
      id: "slot-cleanup",
      startsAt: "2026-06-10T10:00:00.000Z",
      endsAt: "2026-06-10T13:00:00.000Z",
      publicNote: null,
      capacity: 1,
      serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
      allowedServiceIds: [],
      bookedIntervals: [bookedInterval],
    };
  }

  test("offers 11:15 after a 10:00-11:00 service with 15 minute cleanup block", () => {
    const options = buildSlotTimeOptions(
      buildCatalogSlot({
        startsAt: "2026-06-10T10:00:00.000Z",
        endsAt: "2026-06-10T11:15:00.000Z",
      }),
      60,
    );

    const starts = options.filter((option) => !option.isDisabled).map((option) => option.startsAt);

    assert.ok(starts.includes("2026-06-10T11:15:00.000Z"));
  });

  test("offers 11:45 after a 10:00-11:30 service with 15 minute cleanup block", () => {
    const options = buildSlotTimeOptions(
      buildCatalogSlot({
        startsAt: "2026-06-10T10:00:00.000Z",
        endsAt: "2026-06-10T11:45:00.000Z",
      }),
      60,
    );

    const starts = options.filter((option) => !option.isDisabled).map((option) => option.startsAt);

    assert.ok(starts.includes("2026-06-10T11:45:00.000Z"));
  });

  test("offers 11:30 after a 10:00-11:15 service with 15 minute cleanup block", () => {
    const options = buildSlotTimeOptions(
      buildCatalogSlot({
        startsAt: "2026-06-10T10:00:00.000Z",
        endsAt: "2026-06-10T11:30:00.000Z",
      }),
      60,
    );

    const starts = options.filter((option) => !option.isDisabled).map((option) => option.startsAt);

    assert.ok(starts.includes("2026-06-10T11:30:00.000Z"));
  });

  test("requires the new booking's own cleanup block to fit into the slot", () => {
    const options = buildSlotTimeOptions(
      {
        id: "slot-own-cleanup",
        startsAt: "2026-06-10T10:00:00.000Z",
        endsAt: "2026-06-10T11:00:00.000Z",
        publicNote: null,
        capacity: 1,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        allowedServiceIds: [],
        bookedIntervals: [],
      },
      60,
      15,
    );

    assert.equal(options.length, 0);
  });

  test("keeps the option end at the client-visible service end", () => {
    const options = buildSlotTimeOptions(
      {
        id: "slot-public-summary",
        startsAt: "2026-06-10T10:00:00.000Z",
        endsAt: "2026-06-10T12:00:00.000Z",
        publicNote: null,
        capacity: 1,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        allowedServiceIds: [],
        bookedIntervals: [],
      },
      75,
      15,
    );

    assert.equal(options[0]?.startsAt, "2026-06-10T10:00:00.000Z");
    assert.equal(options[0]?.endsAt, "2026-06-10T11:15:00.000Z");
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

  test("falls back to the slot containing the requested start when the preferred slot is later", () => {
    const coverage = resolvePublishedSlotCoverage(
      [
        {
          id: "slot-before",
          startsAt: new Date("2026-04-27T08:00:00.000Z"),
          endsAt: new Date("2026-04-27T09:00:00.000Z"),
          capacity: 1,
          status: AvailabilitySlotStatus.PUBLISHED,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServices: [],
        },
        {
          id: "slot-current",
          startsAt: new Date("2026-04-27T09:00:00.000Z"),
          endsAt: new Date("2026-04-27T10:00:00.000Z"),
          capacity: 1,
          status: AvailabilitySlotStatus.PUBLISHED,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServices: [],
        },
      ],
      "service-1",
      new Date("2026-04-27T08:30:00.000Z"),
      new Date("2026-04-27T09:30:00.000Z"),
      "slot-current",
    );

    assert.deepEqual(coverage?.coverage.map((slot) => slot.id), ["slot-before", "slot-current"]);
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
