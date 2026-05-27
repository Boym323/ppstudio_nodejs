import assert from "node:assert/strict";
import test from "node:test";

import { findInitialSelectedService, formatSlotTime, getSlotDateKey } from "./helpers";

test("public booking client displays catalog ISO times as Prague salon time", () => {
  const winterStartsAt = "2026-01-15T08:00:00.000Z";
  const summerStartsAt = "2026-07-15T07:00:00.000Z";

  assert.equal(getSlotDateKey(winterStartsAt), "2026-01-15");
  assert.equal(formatSlotTime(winterStartsAt), "09:00");
  assert.equal(getSlotDateKey(summerStartsAt), "2026-07-15");
  assert.equal(formatSlotTime(summerStartsAt), "09:00");
});

test("findInitialSelectedService returns the matching catalog service for a valid slug", () => {
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

test("findInitialSelectedService ignores missing or blank slugs", () => {
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
