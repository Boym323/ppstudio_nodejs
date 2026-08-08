import assert from "node:assert/strict";
import test from "node:test";

import { buildAuditChange } from "./audit-change";
import { buildServiceOperationalAuditChange, type ServiceAuditState } from "./service-audit-change";

const service: ServiceAuditState = {
  categoryId: "category-1",
  categoryName: "Kosmetická ošetření",
  name: "Lash lifting",
  publicName: "Korejský lash lifting",
  seoTitle: null,
  description: null,
  publicIntro: null,
  seoDescription: null,
  idealFor: [],
  includes: [],
  benefits: [],
  goodToKnow: [],
  pricingShortDescription: null,
  pricingBadge: null,
  durationMinutes: 60,
  cleanupMinutes: 10,
  priceFromCzk: 1_500,
  sortOrder: 10,
  isFeaturedOnHomepage: false,
  homepageSortOrder: 0,
  isActive: true,
  isPubliclyBookable: true,
};

test("audit helper creates only changed before/after keys and skips no-op", () => {
  assert.equal(buildAuditChange({ role: "SALON" }, { role: "SALON" }), null);
  assert.deepEqual(buildAuditChange(
    { role: "SALON", isActive: true },
    { role: "OWNER", isActive: true },
  ), { before: { role: "SALON" }, after: { role: "OWNER" } });
});

test("service visibility/bookability is audited without duplicating price audit", () => {
  const availabilityChange = buildServiceOperationalAuditChange(service, {
    ...service,
    isActive: false,
    isPubliclyBookable: false,
  });
  assert.deepEqual(availabilityChange, {
    before: { isActive: true, isPubliclyBookable: true },
    after: { isActive: false, isPubliclyBookable: false },
  });
  assert.equal(buildServiceOperationalAuditChange(service, { ...service, priceFromCzk: 1_700 }), null);
  assert.equal(buildServiceOperationalAuditChange(service, { ...service }), null);
});

test("změna kategorie služby ukládá ID i historický název", () => {
  assert.deepEqual(buildServiceOperationalAuditChange(service, {
    ...service,
    categoryId: "category-2",
    categoryName: "Speciální ošetření",
  }), {
    before: { categoryId: { categoryId: "category-1", categoryName: "Kosmetická ošetření" } },
    after: { categoryId: { categoryId: "category-2", categoryName: "Speciální ošetření" } },
  });
});

test("veřejný obsah služby se audituje jen seznamem změněných polí", () => {
  assert.deepEqual(buildServiceOperationalAuditChange(service, {
    ...service,
    description: "Nový dlouhý veřejný text",
  }), {
    before: { publicContentFields: [] },
    after: { publicContentFields: ["description"] },
  });
});
