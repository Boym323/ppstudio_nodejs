import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createServiceSchema } from "./admin-service-validation";

function buildValidInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    area: "owner",
    returnTo: "/admin/sluzby",
    categoryId: "category-1",
    name: "Lash lifting",
    description: "Detailní popis služby pro veřejný web.",
    publicIntro: "Krátký veřejný popis služby.",
    seoTitle: "Lash lifting Zlín | PP Studio",
    seoDescription: "Přirozené zvýraznění vlastních řas v PP Studiu Zlín.",
    idealFor: "vlastní řasy bez prodlužování\n  otevřenější pohled  \n\nčeskou diakritiku",
    includes: "konzultaci\nnatočení a fixaci\nvýživu řas",
    benefits: "výraznější pohled\nsnazší ranní úpravu",
    goodToKnow: "prvních 24 hodin řasy nenamáčet",
    pricingShortDescription: "Přirozené zvýraznění řas.",
    pricingBadge: "",
    durationMinutes: "60",
    priceFromCzk: "900",
    isFeaturedOnHomepage: false,
    homepageSortOrder: "10",
    isActive: true,
    isPubliclyBookable: true,
    ...overrides,
  };
}

describe("createServiceSchema", () => {
  it("převede textarea řádky na trimovaný seznam a zachová diakritiku", () => {
    const parsed = createServiceSchema.parse(buildValidInput());

    assert.deepEqual(parsed.idealFor, [
      "vlastní řasy bez prodlužování",
      "otevřenější pohled",
      "českou diakritiku",
    ]);
  });

  it("odmítne více než osm bodů ve strukturované sekci", () => {
    const result = createServiceSchema.safeParse(buildValidInput({
      idealFor: Array.from({ length: 9 }, (_, index) => `bod ${index + 1}`).join("\n"),
    }));

    assert.equal(result.success, false);
    if (result.success) {
      throw new Error("Validace měla selhat.");
    }
    assert.match(result.error.flatten().fieldErrors.idealFor?.[0] ?? "", /maximálně 8 bodů/);
  });

  it("odmítne příliš dlouhý bod ve strukturované sekci", () => {
    const result = createServiceSchema.safeParse(buildValidInput({
      includes: "a".repeat(241),
    }));

    assert.equal(result.success, false);
    if (result.success) {
      throw new Error("Validace měla selhat.");
    }
    assert.match(result.error.flatten().fieldErrors.includes?.[0] ?? "", /maximálně 240 znaků/);
  });
});
