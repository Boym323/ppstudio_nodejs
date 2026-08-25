import assert from "node:assert/strict";
import test from "node:test";

const baseService = {
  slug: "lash-lifting",
  name: "Lash lifting",
  publicName: null,
  priceFromCzk: 1200,
  durationMinutes: 60,
  publicIntro: "Šetrné zvýraznění řas.",
  description: "Šetrné zvýraznění řas.",
  seoDescription: null,
  seoTitle: null,
  idealFor: [],
  includes: [],
  benefits: [],
  goodToKnow: [],
  category: { name: "Řasy" },
};

test("mapService použije ServiceMedia alt override a zachová fallback bez médií", async () => {
  process.env.NEXT_PUBLIC_APP_NAME = "PP Studio";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
  process.env.ADMIN_SESSION_SECRET = "test-secret-value-with-at-least-32-chars";
  process.env.ADMIN_OWNER_EMAIL = "owner@example.com";
  process.env.EMAIL_DELIVERY_MODE = "log";
  const { mapService } = await import("./public-services");
  const withoutMedia = mapService(baseService as never);
  assert.equal(withoutMedia.heroImage, undefined);
  assert.deepEqual(withoutMedia.galleryImages, []);

  const withMedia = mapService({
    ...baseService,
    media: [
      { role: "GALLERY", sortOrder: 20, altText: null, mediaAsset: { altText: "Výchozí alt", optimizedUrl: "/optimized.jpg", url: "/original.jpg", thumbnailUrl: "/thumbnail.jpg" } },
      { role: "HERO", sortOrder: 0, altText: "Vlastní alt", mediaAsset: { altText: "Výchozí hero", optimizedUrl: null, url: "/hero.jpg", thumbnailUrl: null } },
    ],
  } as never);

  assert.deepEqual(withMedia.heroImage, { src: "/hero.jpg", alt: "Vlastní alt" });
  assert.deepEqual(withMedia.galleryImages, [{ src: "/optimized.jpg", alt: "Výchozí alt" }]);
});
