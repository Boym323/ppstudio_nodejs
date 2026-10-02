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
});
