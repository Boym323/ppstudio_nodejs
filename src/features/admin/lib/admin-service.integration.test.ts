import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("Service.cleanupMinutes defaults to zero and can be edited", async () => {
  const { prisma } = await import("@/lib/prisma");
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Kategorie cleanup ${suffix}`,
      slug: `kategorie-cleanup-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Služba cleanup ${suffix}`,
      slug: `sluzba-cleanup-${suffix}`,
      durationMinutes: 60,
      priceFromCzk: 1200,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: {
      id: true,
      cleanupMinutes: true,
    },
  });

  try {
    assert.equal(service.cleanupMinutes, 0);

    const updated = await prisma.service.update({
      where: { id: service.id },
      data: { cleanupMinutes: 25 },
      select: { cleanupMinutes: true },
    });

    assert.equal(updated.cleanupMinutes, 25);
  } finally {
    await prisma.service.deleteMany({ where: { id: service.id } });
    await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
  }
});
