import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole } from "@prisma/client";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("service availability flags are audited atomically without a price log", async () => {
  const [{ prisma }, { toggleServiceOperationalFlag }] = await Promise.all([
    import("@/lib/prisma"),
    import("./service-change-operations"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const actor = await prisma.adminUser.create({ data: { email: `service-audit-${suffix}@example.com`, name: "Service audit", role: AdminRole.SALON } });
  const category = await prisma.serviceCategory.create({ data: { name: `Audit ${suffix}`, slug: `audit-${suffix}` } });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Audit service ${suffix}`,
      slug: `audit-service-${suffix}`,
      durationMinutes: 60,
      isActive: true,
      isPubliclyBookable: true,
    },
  });

  try {
    assert.equal(await toggleServiceOperationalFlag({ serviceId: service.id, actorUserId: actor.id, field: "isPubliclyBookable" }), true);
    const audit = await prisma.serviceChangeLog.findFirstOrThrow({ where: { serviceId: service.id } });
    assert.deepEqual(audit.before, { isPubliclyBookable: true });
    assert.deepEqual(audit.after, { isPubliclyBookable: false });
    assert.equal(audit.actorUserId, actor.id);
    assert.equal(await prisma.servicePriceChangeLog.count({ where: { serviceId: service.id } }), 0);

    await assert.rejects(() => toggleServiceOperationalFlag({
      serviceId: service.id,
      actorUserId: `missing-${suffix}`,
      field: "isActive",
    }));
    const afterFailure = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });
    assert.equal(afterFailure.isActive, true);
    assert.equal(await prisma.serviceChangeLog.count({ where: { serviceId: service.id } }), 1);
  } finally {
    await prisma.serviceChangeLog.deleteMany({ where: { serviceId: service.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
    await prisma.adminUser.delete({ where: { id: actor.id } });
  }
});
