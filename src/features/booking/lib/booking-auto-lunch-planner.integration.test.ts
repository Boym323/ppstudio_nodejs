import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AvailabilitySlotStatus } from "@/generated/prisma/browser";

import { resolvePragueLocalDateTime } from "./booking-local-time";

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;
const localDate = "2031-07-14";

function at(time: string) {
  const value = resolvePragueLocalDateTime(localDate, time);
  assert.ok(value);
  return value;
}

async function loadModules() {
  const [{ prisma }, { loadAutoLunchPolicySnapshot }, { getAdminPlannerWeek }] = await Promise.all([
    import("@/lib/prisma"),
    import("./booking-auto-lunch-policy"),
    import("@/features/admin/lib/admin-slots/queries"),
  ]);
  return { prisma, loadAutoLunchPolicySnapshot, getAdminPlannerWeek };
}

dbTest("planner persistence projde skutečný cyklus AUTO → OFF → AUTO včetně auditu a derived eventu", async () => {
  const { prisma, loadAutoLunchPolicySnapshot, getAdminPlannerWeek } = await loadModules();
  const suffix = randomUUID();
  const actor = await prisma.adminUser.create({
    data: {
      email: `phase7-planner-${suffix}@example.com`,
      name: "Phase 7 planner audit",
      role: "OWNER",
    },
    select: { id: true },
  });
  const slot = await prisma.availabilitySlot.create({
    data: {
      startsAt: at("09:00"),
      endsAt: at("17:00"),
      status: AvailabilitySlotStatus.PUBLISHED,
      publishedAt: new Date(),
      createdByUserId: actor.id,
    },
    select: { id: true },
  });

  try {
    const initialPolicy = await loadAutoLunchPolicySnapshot(prisma, [localDate]);
    const initialDay = (await getAdminPlannerWeek("owner", localDate)).days.find((day) => day.dateKey === localDate);
    assert.equal(initialPolicy.dayLunchModes[localDate] ?? "AUTO", "AUTO");
    assert.ok(initialDay?.autoLunch.startsAt && initialDay.autoLunch.endsAt);
    assert.equal(new Date(initialDay.autoLunch.endsAt).getTime() - new Date(initialDay.autoLunch.startsAt).getTime(), 45 * 60_000);

    await prisma.$transaction([
      prisma.autoLunchDayOverride.create({ data: { dateKey: localDate, updatedByUserId: actor.id } }),
      prisma.availabilityAuditEvent.create({ data: {
        actorUserId: actor.id,
        actorRole: "OWNER",
        adminArea: "owner",
        dateKey: localDate,
        operation: "ADD",
        source: "auto-lunch-day-override-v1",
        operationId: randomUUID(),
        before: { dayLunchMode: "AUTO" },
        after: { dayLunchMode: "OFF" },
        createdSlots: [],
        archivedOrRemovedSlots: [],
      } }),
    ]);

    const offPolicy = await loadAutoLunchPolicySnapshot(prisma, [localDate]);
    const offDay = (await getAdminPlannerWeek("owner", localDate)).days.find((day) => day.dateKey === localDate);
    assert.equal(await prisma.autoLunchDayOverride.count({ where: { dateKey: localDate } }), 1);
    assert.equal(offPolicy.dayLunchModes[localDate], "OFF");
    assert.equal(offDay?.autoLunch.mode, "OFF");
    assert.equal(offDay?.autoLunch.startsAt, null);

    await prisma.$transaction([
      prisma.autoLunchDayOverride.deleteMany({ where: { dateKey: localDate } }),
      prisma.availabilityAuditEvent.create({ data: {
        actorUserId: actor.id,
        actorRole: "OWNER",
        adminArea: "owner",
        dateKey: localDate,
        operation: "REMOVE",
        source: "auto-lunch-day-override-v1",
        operationId: randomUUID(),
        before: { dayLunchMode: "OFF" },
        after: { dayLunchMode: "AUTO" },
        createdSlots: [],
        archivedOrRemovedSlots: [],
      } }),
    ]);

    const autoPolicy = await loadAutoLunchPolicySnapshot(prisma, [localDate]);
    const autoDay = (await getAdminPlannerWeek("owner", localDate)).days.find((day) => day.dateKey === localDate);
    assert.equal(await prisma.autoLunchDayOverride.count({ where: { dateKey: localDate } }), 0);
    assert.equal(autoPolicy.dayLunchModes[localDate] ?? "AUTO", "AUTO");
    assert.equal(autoDay?.autoLunch.mode, "AUTO");
    assert.ok(autoDay?.autoLunch.startsAt && autoDay.autoLunch.endsAt);
    assert.equal(
      await prisma.availabilityAuditEvent.count({
        where: { dateKey: localDate, source: "auto-lunch-day-override-v1", actorUserId: actor.id },
      }),
      2,
    );
  } finally {
    await prisma.availabilityAuditEvent.deleteMany({ where: { actorUserId: actor.id } });
    await prisma.autoLunchDayOverride.deleteMany({ where: { dateKey: localDate } });
    await prisma.availabilitySlot.deleteMany({ where: { id: slot.id } });
    await prisma.adminUser.deleteMany({ where: { id: actor.id } });
  }
});
