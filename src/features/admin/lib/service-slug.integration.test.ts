import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole } from "@/generated/prisma/client";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("změna veřejného slugu zachová všechny aliasy a audit", async (t) => {
  const [{ prisma }, { changeServiceSlug }] = await Promise.all([
    import("@/lib/prisma"),
    import("./service-slug"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const actor = await prisma.adminUser.create({ data: { email: `slug-domain-${suffix}@example.com`, name: "Slug domain", role: AdminRole.OWNER } });
  const category = await prisma.serviceCategory.create({ data: { name: `Slug domain ${suffix}`, slug: `slug-domain-${suffix}` } });
  const service = await prisma.service.create({
    data: { categoryId: category.id, name: "Skin Ritual", slug: `skin-ritual-${suffix}`, durationMinutes: 60, publicIntro: "Veřejný popis." },
  });
  const otherService = await prisma.service.create({
    data: { categoryId: category.id, name: "Other", slug: `other-${suffix}`, durationMinutes: 60 },
  });

  t.after(async () => {
    await prisma.serviceChangeLog.deleteMany({ where: { serviceId: { in: [service.id, otherService.id] } } });
    await prisma.serviceSlugAlias.deleteMany({ where: { serviceId: { in: [service.id, otherService.id] } } });
    await prisma.service.deleteMany({ where: { id: { in: [service.id, otherService.id] } } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
    await prisma.adminUser.delete({ where: { id: actor.id } });
  });

  assert.deepEqual(await changeServiceSlug({ serviceId: service.id, targetSlug: `skin-signature-${suffix}`, actorUserId: actor.id }), {
    changed: true,
    beforeSlug: `skin-ritual-${suffix}`,
    afterSlug: `skin-signature-${suffix}`,
  });
  assert.deepEqual(await changeServiceSlug({ serviceId: service.id, targetSlug: `skin-luxury-${suffix}`, actorUserId: actor.id }), {
    changed: true,
    beforeSlug: `skin-signature-${suffix}`,
    afterSlug: `skin-luxury-${suffix}`,
  });
  assert.deepEqual(await changeServiceSlug({ serviceId: service.id, targetSlug: `skin-luxury-${suffix}`, actorUserId: actor.id }), {
    changed: false,
    beforeSlug: `skin-luxury-${suffix}`,
    afterSlug: `skin-luxury-${suffix}`,
  });

  assert.deepEqual(
    (await prisma.serviceSlugAlias.findMany({ where: { serviceId: service.id }, orderBy: { createdAt: "asc" }, select: { slug: true } })).map((alias) => alias.slug),
    [`skin-ritual-${suffix}`, `skin-signature-${suffix}`],
  );
  assert.equal(await prisma.serviceChangeLog.count({ where: { serviceId: service.id } }), 2);
  await assert.rejects(
    changeServiceSlug({ serviceId: service.id, targetSlug: `other-${suffix}`, actorUserId: actor.id }),
    /již použita/,
  );
  await prisma.serviceSlugAlias.create({ data: { serviceId: otherService.id, slug: `reserved-${suffix}` } });
  await assert.rejects(
    changeServiceSlug({ serviceId: service.id, targetSlug: `reserved-${suffix}`, actorUserId: actor.id }),
    /již použita/,
  );
});
