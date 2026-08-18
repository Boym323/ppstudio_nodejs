import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole, SiteSettingsChangeOperation } from "@/generated/prisma/browser";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("booking policy audit stores actor and rolls back when audit insert fails", async () => {
  const [{ prisma }, { updateSiteSettingsWithAudit }, { ensureSiteSettings, SITE_SETTINGS_ID }] = await Promise.all([
    import("@/lib/prisma"),
    import("./site-settings-audit"),
    import("@/lib/site-settings"),
  ]);
  const original = await ensureSiteSettings();
  const suffix = randomUUID().slice(0, 8);
  const actor = await prisma.adminUser.create({ data: { email: `settings-audit-${suffix}@example.com`, name: "Settings audit", role: AdminRole.OWNER } });
  const nextCancellationHours = original.bookingCancellationHours + 1;
  const snapshots = (current: typeof original) => ({
    before: {
      bookingMinAdvanceHours: current.bookingMinAdvanceHours,
      bookingMaxAdvanceDays: current.bookingMaxAdvanceDays,
      bookingCancellationHours: current.bookingCancellationHours,
    },
    after: {
      bookingMinAdvanceHours: current.bookingMinAdvanceHours,
      bookingMaxAdvanceDays: current.bookingMaxAdvanceDays,
      bookingCancellationHours: nextCancellationHours,
    },
  });

  try {
    await updateSiteSettingsWithAudit({
      actorUserId: actor.id,
      operation: SiteSettingsChangeOperation.UPDATE_BOOKING_POLICY,
      data: { bookingCancellationHours: nextCancellationHours },
      snapshots,
    });
    const audit = await prisma.siteSettingsChangeLog.findFirstOrThrow({ where: { actorUserId: actor.id } });
    assert.equal(audit.actorUserId, actor.id);
    assert.deepEqual(audit.before, { bookingCancellationHours: original.bookingCancellationHours });
    assert.deepEqual(audit.after, { bookingCancellationHours: nextCancellationHours });

    await assert.rejects(() => updateSiteSettingsWithAudit({
      actorUserId: `missing-${suffix}`,
      operation: SiteSettingsChangeOperation.UPDATE_BOOKING_POLICY,
      data: { bookingCancellationHours: nextCancellationHours + 1 },
      snapshots: (current) => ({
        before: { bookingCancellationHours: current.bookingCancellationHours },
        after: { bookingCancellationHours: nextCancellationHours + 1 },
      }),
    }));
    const afterFailure = await prisma.siteSettings.findUniqueOrThrow({ where: { id: SITE_SETTINGS_ID } });
    assert.equal(afterFailure.bookingCancellationHours, nextCancellationHours);
    assert.equal(await prisma.siteSettingsChangeLog.count({ where: { actorUserId: actor.id } }), 1);
  } finally {
    await prisma.siteSettingsChangeLog.deleteMany({ where: { actorUserId: actor.id } });
    await prisma.siteSettings.update({
      where: { id: SITE_SETTINGS_ID },
      data: {
        bookingMinAdvanceHours: original.bookingMinAdvanceHours,
        bookingMaxAdvanceDays: original.bookingMaxAdvanceDays,
        bookingCancellationHours: original.bookingCancellationHours,
        updatedByUserId: original.updatedByUserId,
      },
    });
    await prisma.adminUser.delete({ where: { id: actor.id } });
  }
});
