import assert from "node:assert/strict";
import test from "node:test";

import {
  findInitialSelectedService,
  getSlotHour,
  formatSlotTime,
  getSlotDateKey,
  shouldTrackPrefilledServiceSelectionEvent,
} from "./helpers";

test("klient veřejné rezervace zobrazí katalogové ISO časy jako čas salonu v Praze", () => {
  const winterStartsAt = "2026-01-15T08:00:00.000Z";
  const summerStartsAt = "2026-07-15T07:00:00.000Z";

  assert.equal(getSlotDateKey(winterStartsAt), "2026-01-15");
  assert.equal(formatSlotTime(winterStartsAt), "09:00");
  assert.equal(getSlotDateKey(summerStartsAt), "2026-07-15");
  assert.equal(formatSlotTime(summerStartsAt), "09:00");
  assert.equal(getSlotHour(winterStartsAt), 9);
  assert.equal(getSlotHour(summerStartsAt), 9);
});

test("findInitialSelectedService vrátí odpovídající katalogovou službu pro platný slug", () => {
  const selectedService = findInitialSelectedService(
    [
      {
        id: "service-1",
        categoryName: "Řasy",
        name: "Lash lifting",
        slug: "lash-lifting",
        shortDescription: null,
        durationMinutes: 60,
        cleanupBlockMinutes: 0,
        priceFromCzk: 1200,
      },
      {
        id: "service-2",
        categoryName: "Obočí",
        name: "Laminace obočí",
        slug: "laminace-oboci",
        shortDescription: null,
        durationMinutes: 45,
        cleanupBlockMinutes: 0,
        priceFromCzk: 990,
      },
    ],
    "laminace-oboci",
  );

  assert.equal(selectedService?.id, "service-2");
});

test("findInitialSelectedService ignoruje chybějící nebo prázdné slugy", () => {
  const services = [
    {
      id: "service-1",
      categoryName: "Řasy",
      name: "Lash lifting",
      slug: "lash-lifting",
      shortDescription: null,
      durationMinutes: 60,
      cleanupBlockMinutes: 0,
      priceFromCzk: 1200,
    },
  ];

  assert.equal(findInitialSelectedService(services, "neznamy-slug"), undefined);
  assert.equal(findInitialSelectedService(services, "   "), undefined);
});

test("shouldTrackPrefilledServiceSelectionEvent tracks prefilled service from query once", () => {
  const selectedService = {
    id: "service-1",
    categoryName: "Řasy",
    name: "Lash lifting",
    slug: "lash-lifting",
    shortDescription: null,
    durationMinutes: 60,
    cleanupBlockMinutes: 0,
    priceFromCzk: 1200,
  };

  assert.equal(
    shouldTrackPrefilledServiceSelectionEvent("lash-lifting", selectedService, false),
    true,
  );
  assert.equal(
    shouldTrackPrefilledServiceSelectionEvent("lash-lifting", selectedService, true),
    false,
  );
});

test("shouldTrackPrefilledServiceSelectionEvent returns false without query service or selected service", () => {
  const selectedService = {
    id: "service-2",
    categoryName: "Obočí",
    name: "Laminace obočí",
    slug: "laminace-oboci",
    shortDescription: null,
    durationMinutes: 45,
    cleanupBlockMinutes: 0,
    priceFromCzk: 990,
  };

  assert.equal(
    shouldTrackPrefilledServiceSelectionEvent(undefined, selectedService, false),
    false,
  );
  assert.equal(
    shouldTrackPrefilledServiceSelectionEvent("laminace-oboci", undefined, false),
    false,
  );
});
