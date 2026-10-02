import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole } from "@/generated/prisma/client";
import type { ServiceSlugCutoverPlan } from "./service-slug-cutover";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("slugový cutover zachová starou URL jako alias a používá nový kanonický slug", async (t) => {
  const [{ prisma }, cutover, publicServices] = await Promise.all([
    import("@/lib/prisma"),
    import("./service-slug-cutover"),
    import("@/features/public/lib/public-services"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const oldSlug = `old-skin-${suffix}`;
  const targetSlug = `skin-balance-${suffix}`;
  const actor = await prisma.adminUser.create({
    data: { email: `slug-cutover-${suffix}@example.com`, name: "Slug cutover test", role: AdminRole.OWNER },
  });
  const category = await prisma.serviceCategory.create({ data: { name: `Slug ${suffix}`, slug: `slug-${suffix}` } });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: "Skin Balance",
      slug: oldSlug,
      publicIntro: "Veřejný popis služby.",
      durationMinutes: 60,
      isActive: true,
      isPubliclyBookable: true,
    },
  });
  t.after(async () => {
    await prisma.serviceChangeLog.deleteMany({ where: { serviceId: service.id } });
    await prisma.serviceSlugAlias.deleteMany({ where: { serviceId: service.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
    await prisma.adminUser.delete({ where: { id: actor.id } });
  });

  const plan: ServiceSlugCutoverPlan = {
    cutoverId: cutover.SERVICE_SLUG_CUTOVER_ID,
    actorUserId: actor.id,
    changes: [{ serviceId: service.id, expectedSlug: oldSlug, targetSlug }],
  };

  assert.deepEqual(await cutover.previewServiceSlugCutover(plan), [{
    serviceId: service.id,
    currentSlug: oldSlug,
    expectedSlug: oldSlug,
    targetSlug,
    expectedMatches: true,
    alreadyApplied: false,
  }]);
  assert.deepEqual(await cutover.applyServiceSlugCutover(plan), {
    status: "applied",
    changedServiceIds: [service.id],
  });
  assert.deepEqual(await cutover.applyServiceSlugCutover(plan), {
    status: "already-applied",
    changedServiceIds: [],
  });

  const [oldDetail, canonicalDetail, oldBooking] = await Promise.all([
    publicServices.resolvePublicServiceSlug(oldSlug),
    publicServices.resolvePublicServiceSlug(targetSlug),
    publicServices.resolvePublicBookingServiceSlug(oldSlug),
  ]);
  assert.deepEqual(oldDetail && { slug: oldDetail.service.slug, isCanonical: oldDetail.isCanonical }, { slug: targetSlug, isCanonical: false });
  assert.deepEqual(canonicalDetail && { slug: canonicalDetail.service.slug, isCanonical: canonicalDetail.isCanonical }, { slug: targetSlug, isCanonical: true });
  assert.deepEqual(oldBooking, { slug: targetSlug, isCanonical: false });
  assert.equal(await prisma.serviceSlugAlias.count({ where: { serviceId: service.id, slug: oldSlug } }), 1);

  const sitemapEntries = await publicServices.getPublicServiceSitemapEntries();
  assert.equal(sitemapEntries.some((entry) => entry.slug === targetSlug), true);
  assert.equal(sitemapEntries.some((entry) => entry.slug === oldSlug), false);
});

dbTest("slugový cutover odmítne kolizi cílového slugu se službou i aliasem", async (t) => {
  const [{ prisma }, cutover] = await Promise.all([
    import("@/lib/prisma"),
    import("./service-slug-cutover"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const actor = await prisma.adminUser.create({
    data: { email: `slug-collision-${suffix}@example.com`, name: "Slug collision test", role: AdminRole.OWNER },
  });
  const category = await prisma.serviceCategory.create({ data: { name: `Collision ${suffix}`, slug: `collision-${suffix}` } });
  const service = await prisma.service.create({
    data: { categoryId: category.id, name: "Source", slug: `source-${suffix}`, publicIntro: "Veřejný popis.", durationMinutes: 60, isActive: true, isPubliclyBookable: true },
  });
  const targetService = await prisma.service.create({
    data: { categoryId: category.id, name: "Target", slug: `target-${suffix}`, durationMinutes: 60 },
  });
  const aliasOwner = await prisma.service.create({
    data: { categoryId: category.id, name: "Alias owner", slug: `alias-owner-${suffix}`, durationMinutes: 60 },
  });
  const aliasSlug = `reserved-${suffix}`;
  await prisma.serviceSlugAlias.create({ data: { serviceId: aliasOwner.id, slug: aliasSlug } });
  t.after(async () => {
    await prisma.serviceSlugAlias.deleteMany({ where: { serviceId: { in: [service.id, aliasOwner.id] } } });
    await prisma.service.deleteMany({ where: { id: { in: [service.id, targetService.id, aliasOwner.id] } } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
    await prisma.adminUser.delete({ where: { id: actor.id } });
  });

  const basePlan: ServiceSlugCutoverPlan = {
    cutoverId: cutover.SERVICE_SLUG_CUTOVER_ID,
    actorUserId: actor.id,
    changes: [{ serviceId: service.id, expectedSlug: `source-${suffix}`, targetSlug: `target-${suffix}` }],
  };
  await assert.rejects(cutover.applyServiceSlugCutover(basePlan), /Cílový slug/);
  await assert.rejects(
    cutover.applyServiceSlugCutover({ ...basePlan, changes: [{ ...basePlan.changes[0], targetSlug: aliasSlug }] }),
    /Cílový slug/,
  );
});

dbTest("slugový cutover odmítne částečně aplikovaný stav", async (t) => {
  const [{ prisma }, cutover] = await Promise.all([
    import("@/lib/prisma"),
    import("./service-slug-cutover"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const actor = await prisma.adminUser.create({
    data: { email: `slug-partial-${suffix}@example.com`, name: "Slug partial test", role: AdminRole.OWNER },
  });
  const category = await prisma.serviceCategory.create({ data: { name: `Partial ${suffix}`, slug: `partial-${suffix}` } });
  const service = await prisma.service.create({
    data: { categoryId: category.id, name: "Partial", slug: `partial-target-${suffix}`, durationMinutes: 60 },
  });
  const oldSlug = `partial-old-${suffix}`;
  t.after(async () => {
    await prisma.serviceSlugAlias.deleteMany({ where: { serviceId: service.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
    await prisma.adminUser.delete({ where: { id: actor.id } });
  });

  await assert.rejects(
    cutover.applyServiceSlugCutover({
      cutoverId: cutover.SERVICE_SLUG_CUTOVER_ID,
      actorUserId: actor.id,
      changes: [{ serviceId: service.id, expectedSlug: oldSlug, targetSlug: service.slug }],
    }),
    /Cutover odmítnut/,
  );
});
