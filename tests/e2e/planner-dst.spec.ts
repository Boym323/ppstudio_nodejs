import { randomBytes } from "crypto";

import { expect, test, type Page } from "@playwright/test";
import { AdminRole, AvailabilitySlotServiceRestrictionMode, AvailabilitySlotStatus } from "@prisma/client";

import { getCellRangeBounds } from "../../src/features/admin/lib/admin-slots/time";
import { hashPassword } from "../../src/lib/auth/password";
import { prisma } from "../../src/lib/prisma";

function buildRunId() {
  return `e2e-dst-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

async function loginAdmin(page: Page, email: string, password: string) {
  await page.goto("/admin/prihlaseni");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

async function createOwner(runId: string) {
  const password = "DstPlanner!123";
  const email = `${runId}-owner@example.test`;
  const passwordHash = await hashPassword(password);

  const user = await prisma.adminUser.create({
    data: {
      email,
      passwordHash,
      name: `DST Planner ${runId}`,
      role: AdminRole.OWNER,
      isActive: true,
    },
    select: { id: true },
  });

  return { userId: user.id, email, password };
}

async function createPlannerSlot(userId: string, dateKey: string, startCell: number, endCell: number) {
  const range = getCellRangeBounds(dateKey, startCell, endCell);

  await prisma.availabilitySlot.create({
    data: {
      startsAt: range.startsAt,
      endsAt: range.endsAt,
      capacity: 1,
      status: AvailabilitySlotStatus.PUBLISHED,
      serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
      publishedAt: new Date(),
      createdByUserId: userId,
    },
  });

  return range;
}

async function cleanupRun(runId: string) {
  const owners = await prisma.adminUser.findMany({
    where: { email: { contains: runId } },
    select: { id: true },
  });
  await prisma.availabilitySlot.deleteMany({ where: { createdByUserId: { in: owners.map((owner) => owner.id) } } });
  await prisma.adminUser.deleteMany({ where: { email: { contains: runId } } });
}

test.describe("planner DST e2e", () => {
  const runIds: string[] = [];

  test.afterEach(async () => {
    await Promise.all(runIds.splice(0).map((runId) => cleanupRun(runId)));
  });

  test("owner can copy a full week over DST and keep local hours", async ({ page }) => {
    test.setTimeout(90_000);

    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);

    await createPlannerSlot(owner.userId, "2027-03-22", 6, 8);

    await loginAdmin(page, owner.email, owner.password);

    await page.goto("/admin/volne-terminy?week=2027-03-22&day=2027-03-22");
    await page.getByRole("button", { name: "Kopírovat týden" }).click();

    await expect(page).toHaveURL(/week=2027-03-29/);

    const target = getCellRangeBounds("2027-03-29", 6, 8);
    await expect.poll(async () => prisma.availabilitySlot.count({
      where: {
        createdByUserId: owner.userId,
        startsAt: target.startsAt,
        endsAt: target.endsAt,
      },
    })).toBe(1);
  });
});
