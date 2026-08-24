import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
} from "@/generated/prisma/browser";

import {
  buildMergedPublicCatalogSlots,
  isInternallyBlockingSlotStatus,
  resolvePublishedSlotCoverage,
} from "./booking-slot-availability";
import { buildSlotTimeOptions } from "./booking-time-slots";

describe("isInternallyBlockingSlotStatus", () => {
  test("blokuje pouze aktivní draft sloty a ignoruje historické stavy", () => {
    assert.equal(isInternallyBlockingSlotStatus(AvailabilitySlotStatus.DRAFT), true);
    assert.equal(isInternallyBlockingSlotStatus(AvailabilitySlotStatus.PUBLISHED), false);
    assert.equal(isInternallyBlockingSlotStatus(AvailabilitySlotStatus.CANCELLED), false);
    assert.equal(isInternallyBlockingSlotStatus(AvailabilitySlotStatus.ARCHIVED), false);
  });
});

describe("buildMergedPublicCatalogSlots", () => {
  test("sloučí sousedící kompatibilní sloty a zachová zdrojové segmenty", () => {
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

  test("vrátí UTC ISO okamžiky, které klienti vykreslí jako čas salonu v Praze", () => {
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
  test("použije segment obsahující vybraný začátek jako slotId", () => {
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

  test("nabídne 11:15 po službě 10:00–11:00 s patnáctiminutovým úklidovým blokem", () => {
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

  test("nabídne 11:45 po službě 10:00–11:30 s patnáctiminutovým úklidovým blokem", () => {
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

  test("nabídne 11:30 po službě 10:00–11:15 s patnáctiminutovým úklidovým blokem", () => {
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

  test("dovolí poslední začátek ve slotu, když přes konec slotu zasahuje pouze úklid", () => {
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

    assert.deepEqual(
      options.map((option) => ({
        startsAt: option.startsAt,
        endsAt: option.endsAt,
        isDisabled: option.isDisabled,
      })),
      [
        {
          startsAt: "2026-06-10T10:00:00.000Z",
          endsAt: "2026-06-10T11:00:00.000Z",
          isDisabled: false,
        },
      ],
    );
  });

  test("zakáže poslední začátek, když úklid na hranici slotu koliduje s rezervací", () => {
    const [slot] = buildMergedPublicCatalogSlots(
      [{
        id: "slot-before-following-booking",
        startsAt: new Date("2026-08-31T06:00:00.000Z"),
        endsAt: new Date("2026-08-31T07:00:00.000Z"),
        publicNote: null,
        capacity: 1,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        allowedServiceIds: [],
      }],
      [{
        startsAt: new Date("2026-08-31T07:00:00.000Z"),
        endsAt: new Date("2026-08-31T08:30:00.000Z"),
      }],
      15,
    );

    assert.ok(slot);
    const [lastOption] = buildSlotTimeOptions(slot, 60, 15);

    assert.equal(slot.bookedIntervals.length, 1);
    assert.equal(lastOption?.startsAt, "2026-08-31T06:00:00.000Z");
    assert.equal(lastOption?.isDisabled, true);
  });

  test("zachová konec nabízeného termínu na klientem viditelném konci služby", () => {
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

  test("nabídne nejpozdější bezpečný čtvrthodinový kandidát před následující rezervací", () => {
    const options = buildSlotTimeOptions(
      buildCatalogSlot({
        startsAt: "2026-06-10T12:00:00.000Z",
        endsAt: "2026-06-10T13:00:00.000Z",
      }),
      50,
      15,
    );

    const candidate = options.find((option) => option.startsAt === "2026-06-10T10:45:00.000Z");

    assert.equal(candidate?.isDisabled, false);
    assert.equal(candidate?.endsAt, "2026-06-10T11:35:00.000Z");
  });

  test("zaokrouhlí pětašedesátiminutovou službu dolů před následující rezervací", () => {
    const slot = buildCatalogSlot({
      startsAt: "2026-06-10T12:00:00.000Z",
      endsAt: "2026-06-10T13:00:00.000Z",
    });
    const options = buildSlotTimeOptions(slot, 65, 15);

    assert.equal(
      options.find((option) => option.startsAt === "2026-06-10T10:30:00.000Z")?.isDisabled,
      false,
    );
  });

  test("zaokrouhlí dolů bez překryvu při šestnáctiminutovém úklidu", () => {
    const options = buildSlotTimeOptions(
      buildCatalogSlot({
        startsAt: "2026-06-10T12:00:00.000Z",
        endsAt: "2026-06-10T13:00:00.000Z",
      }),
      50,
      16,
    );

    assert.equal(
      options.find((option) => option.startsAt === "2026-06-10T10:45:00.000Z")?.isDisabled,
      false,
    );
    assert.equal(
      options.some((option) => option.startsAt === "2026-06-10T11:00:00.000Z" && !option.isDisabled),
      false,
    );
  });

  test("zaokrouhlí předchozí blokovaný interval nahoru na další čtvrthodinu", () => {
    const options = buildSlotTimeOptions(
      {
        ...buildCatalogSlot({
          startsAt: "2026-06-10T09:30:00.000Z",
          endsAt: "2026-06-10T10:17:00.000Z",
        }),
        startsAt: "2026-06-10T10:15:00.000Z",
      },
      30,
    );

    assert.equal(
      options.find((option) => option.startsAt === "2026-06-10T10:30:00.000Z")?.isDisabled,
      false,
    );
    assert.equal(
      options.some((option) => option.startsAt === "2026-06-10T10:15:00.000Z" && !option.isDisabled),
      false,
    );
  });

  test("zachová předchozí blokovaný interval končící přesně na čtvrthodině", () => {
    const options = buildSlotTimeOptions(
      buildCatalogSlot({
        startsAt: "2026-06-10T09:15:00.000Z",
        endsAt: "2026-06-10T10:15:00.000Z",
      }),
      30,
    );

    assert.equal(
      options.find((option) => option.startsAt === "2026-06-10T10:15:00.000Z")?.isDisabled,
      false,
    );
  });

  test("zachová původního přesného kandidáta 90 plus 15 minut", () => {
    const options = buildSlotTimeOptions(
      buildCatalogSlot({
        startsAt: "2026-06-10T12:00:00.000Z",
        endsAt: "2026-06-10T13:00:00.000Z",
      }),
      90,
      15,
    );

    assert.equal(
      options.find((option) => option.startsAt === "2026-06-10T10:15:00.000Z")?.isDisabled,
      false,
    );
  });

  test("does not add a backwards candidate outside the quarter-hour grid or before availability", () => {
    const nonQuarterHour = buildSlotTimeOptions(
      buildCatalogSlot({
        startsAt: "2026-06-10T12:00:00.000Z",
        endsAt: "2026-06-10T13:00:00.000Z",
      }),
      90,
      14,
    );
    const beforeAvailability = buildSlotTimeOptions(
      {
        ...buildCatalogSlot({
          startsAt: "2026-06-10T10:00:00.000Z",
          endsAt: "2026-06-10T11:00:00.000Z",
        }),
        startsAt: "2026-06-10T09:00:00.000Z",
      },
      90,
      15,
    );

    assert.equal(nonQuarterHour.some((option) => option.startsAt === "2026-06-10T10:16:00.000Z"), false);
    assert.equal(beforeAvailability.some((option) => option.startsAt === "2026-06-10T08:15:00.000Z"), false);
  });

  test("does not offer an invalid backwards candidate across a gap or another booking", () => {
    const [firstDiscontinuousSlot] = buildMergedPublicCatalogSlots(
      [
        {
          id: "slot-before-gap",
          startsAt: new Date("2026-06-10T09:00:00.000Z"),
          endsAt: new Date("2026-06-10T10:00:00.000Z"),
          publicNote: null,
          capacity: 1,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServiceIds: [],
        },
        {
          id: "slot-after-gap",
          startsAt: new Date("2026-06-10T11:00:00.000Z"),
          endsAt: new Date("2026-06-10T12:00:00.000Z"),
          publicNote: null,
          capacity: 1,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          allowedServiceIds: [],
        },
      ],
      [{
        startsAt: new Date("2026-06-10T11:00:00.000Z"),
        endsAt: new Date("2026-06-10T12:00:00.000Z"),
      }],
      120,
    );
    assert.ok(firstDiscontinuousSlot);
    assert.equal(buildSlotTimeOptions(firstDiscontinuousSlot, 90, 15).some((option) => option.startsAt === "2026-06-10T09:15:00.000Z"), false);

    const blockedCandidate = buildSlotTimeOptions(
      {
        ...buildCatalogSlot({
          startsAt: "2026-06-10T11:00:00.000Z",
          endsAt: "2026-06-10T11:15:00.000Z",
        }),
        bookedIntervals: [
          { startsAt: "2026-06-10T11:00:00.000Z", endsAt: "2026-06-10T11:15:00.000Z" },
          { startsAt: "2026-06-10T12:00:00.000Z", endsAt: "2026-06-10T13:00:00.000Z" },
        ],
      },
      90, 15,
    );
    assert.equal(blockedCandidate.some((option) => option.startsAt === "2026-06-10T10:15:00.000Z"), false);
  });

  test("odstraní duplicity a chronologicky seřadí zpětné kandidáty", () => {
    const options = buildSlotTimeOptions(
      {
        ...buildCatalogSlot({
          startsAt: "2026-06-10T11:15:00.000Z",
          endsAt: "2026-06-10T12:00:00.000Z",
        }),
        endsAt: "2026-06-10T14:00:00.000Z",
        bookedIntervals: [
          { startsAt: "2026-06-10T11:15:00.000Z", endsAt: "2026-06-10T12:00:00.000Z" },
          { startsAt: "2026-06-10T13:00:00.000Z", endsAt: "2026-06-10T14:00:00.000Z" },
        ],
      },
      60,
      15,
    );
    const starts = options.map((option) => option.startsAt);

    assert.equal(starts.filter((startsAt) => startsAt === "2026-06-10T10:00:00.000Z").length, 1);
    assert.deepEqual(starts, [...starts].sort());
  });
});

describe("resolvePublishedSlotCoverage", () => {
  test("přijme souvislý řetězec publikovaných slotů", () => {
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

  test("odmítne mezeru mezi sloty", () => {
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
