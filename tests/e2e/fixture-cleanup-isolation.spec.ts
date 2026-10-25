import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import { AdminRole, BookingSubmissionOutcome } from "@/generated/prisma/client";

import { getAdminLoginAttemptMetadata } from "@/lib/auth/admin-login-rate-limit";
import {
  assertE2eDatabaseIdentity,
} from "./helpers/database-safety";
import {
  cleanupE2eData,
  createAdminFixture,
  prisma,
} from "./helpers/fixtures";

test("cleanup E2E odstraňuje pouze fixture daného runId a lze ho bezpečně opakovat", async () => {
  await assertE2eDatabaseIdentity();
  await expect(cleanupE2eData("")).rejects.toThrow("jednoznačný runId");

  const runId = `e2e-cleanup-isolation-${Date.now()}-${randomUUID()}`;
  const unrelatedSuffix = randomUUID();
  const unrelatedLogId = `cleanup-regression-log-${unrelatedSuffix}`;
  const unrelatedReservationId = `cleanup-regression-reservation-${unrelatedSuffix}`;
  const fixtureCategorySlug = `e2e-cleanup-category-${runId}`;
  const fixtureServiceSlug = `e2e-cleanup-service-${runId}`;
  const orphanCategorySlug = `e2e-cleanup-orphan-${runId}`;
  let adminEmail: string | undefined;
  let fixtureCategoryId: string | undefined;
  let fixtureServiceId: string | undefined;

  try {
    const admin = await createAdminFixture(runId, AdminRole.OWNER);
    adminEmail = admin.email;
    const adminEmailHash = getAdminLoginAttemptMetadata(new Headers(), admin.email).emailHash;
    if (!adminEmailHash) throw new Error("E2E admin fixture nemá e-mailový hash.");

    const category = await prisma.serviceCategory.create({
      data: {
        name: `E2E cleanup ${runId}`,
        slug: fixtureCategorySlug,
      },
      select: { id: true },
    });
    fixtureCategoryId = category.id;
    const service = await prisma.service.create({
      data: {
        categoryId: category.id,
        name: `E2E cleanup ${runId}`,
        slug: fixtureServiceSlug,
        durationMinutes: 30,
      },
      select: { id: true },
    });
    fixtureServiceId = service.id;
    await prisma.serviceCategory.create({
      data: {
        name: `E2E orphan ${runId}`,
        slug: orphanCategorySlug,
      },
    });

    await prisma.bookingSubmissionLog.create({
      data: {
        id: unrelatedLogId,
        outcome: BookingSubmissionOutcome.FAILED,
        failureCode: `UNRELATED_${unrelatedSuffix}`,
        emailHash: `unrelated-${unrelatedSuffix}`,
      },
    });
    await prisma.bookingSubmissionLog.create({
      data: {
        outcome: BookingSubmissionOutcome.SUCCESS,
        failureCode: "ADMIN_LOGIN_SUCCESS",
        emailHash: adminEmailHash,
      },
    });
    await prisma.rateLimitReservation.create({
      data: {
        id: unrelatedReservationId,
        scope: `unrelated-${unrelatedSuffix}`,
        fingerprint: unrelatedSuffix,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    await prisma.rateLimitReservation.create({
      data: {
        scope: "admin-login-email-failure",
        fingerprint: adminEmailHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await cleanupE2eData(runId);

    expect(await prisma.service.findUnique({ where: { id: service.id } })).toBeNull();
    expect(await prisma.serviceCategory.findUnique({ where: { id: category.id } })).toBeNull();
    expect(await prisma.adminUser.findUnique({ where: { email: adminEmail } })).toBeNull();
    expect(await prisma.bookingSubmissionLog.count({ where: { emailHash: adminEmailHash } })).toBe(0);
    expect(await prisma.rateLimitReservation.count({
      where: { scope: "admin-login-email-failure", fingerprint: adminEmailHash },
    })).toBe(0);
    expect(await prisma.bookingSubmissionLog.findUnique({ where: { id: unrelatedLogId } })).not.toBeNull();
    expect(await prisma.rateLimitReservation.findUnique({ where: { id: unrelatedReservationId } })).not.toBeNull();

    await cleanupE2eData(runId);
    expect(await prisma.bookingSubmissionLog.findUnique({ where: { id: unrelatedLogId } })).not.toBeNull();
    expect(await prisma.rateLimitReservation.findUnique({ where: { id: unrelatedReservationId } })).not.toBeNull();
  } finally {
    try {
      await cleanupE2eData(runId);
    } finally {
      await Promise.all([
        prisma.bookingSubmissionLog.deleteMany({ where: { id: unrelatedLogId } }),
        prisma.rateLimitReservation.deleteMany({ where: { id: unrelatedReservationId } }),
        prisma.service.deleteMany({ where: { id: { in: fixtureServiceId ? [fixtureServiceId] : [] } } }),
        prisma.serviceCategory.deleteMany({ where: { id: { in: fixtureCategoryId ? [fixtureCategoryId] : [] } } }),
        prisma.serviceCategory.deleteMany({ where: { slug: orphanCategorySlug } }),
        ...(adminEmail ? [prisma.adminUser.deleteMany({ where: { email: adminEmail } })] : []),
      ]);
    }
  }
});
