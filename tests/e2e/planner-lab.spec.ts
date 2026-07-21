import { randomBytes } from "crypto";

import { expect, test, type Page } from "@playwright/test";
import { AdminRole, AvailabilitySlotServiceRestrictionMode, AvailabilitySlotStatus } from "@prisma/client";

import { getCellRangeBounds } from "../../src/features/admin/lib/admin-slots/time";
import { hashPassword } from "../../src/lib/auth/password";
import { prisma } from "../../src/lib/prisma";

const plannerDate = "2027-03-22";

function buildRunId() {
  return `e2e-planner-lab-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

async function loginAdmin(page: Page, email: string, password: string) {
  await page.goto("/admin/prihlaseni");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

async function createOwner(runId: string) {
  const password = "PlannerLab!123";
  const user = await prisma.adminUser.create({
    data: {
      email: `${runId}@example.test`,
      passwordHash: await hashPassword(password),
      name: `Planner Lab ${runId}`,
      role: AdminRole.OWNER,
      isActive: true,
    },
    select: { id: true, email: true },
  });

  return { ...user, password };
}

async function createAvailability(ownerId: string, startCell: number, endCell: number, dateKey = plannerDate) {
  const range = getCellRangeBounds(dateKey, startCell, endCell);

  await prisma.availabilitySlot.create({
    data: {
      startsAt: range.startsAt,
      endsAt: range.endsAt,
      capacity: 1,
      status: AvailabilitySlotStatus.PUBLISHED,
      serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
      publishedAt: new Date(),
      createdByUserId: ownerId,
    },
  });
}

async function cleanupRun(runId: string) {
  const users = await prisma.adminUser.findMany({
    where: { email: { contains: runId } },
    select: { id: true },
  });
  await prisma.availabilitySlot.deleteMany({ where: { createdByUserId: { in: users.map((user) => user.id) } } });
  await prisma.adminUser.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
}

test.describe("FullCalendar planner e2e", () => {
  const runIds: string[] = [];

  test.afterEach(async () => {
    await Promise.all(runIds.splice(0).map(cleanupRun));
  });

  test("renders availability and navigates to the following week", async ({ page }) => {
    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);
    await createAvailability(owner.id, 6, 8);

    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${plannerDate}`);

    await expect(page.getByTestId("planner-lab-calendar")).toBeVisible();
    await expect(page.locator(".planner-lab-event--availability").first()).toBeVisible();

    await page.getByRole("button", { name: "Následující týden" }).click();
    await expect(page).toHaveURL(/week=2027-03-29/);
  });

  test("adds availability by clicking an empty calendar cell", async ({ page }) => {
    test.skip(test.info().project.name !== "chromium", "Kliknutí do časové mřížky je pokryté desktopovým workflow.");

    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);
    await createAvailability(owner.id, 6, 8);

    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${plannerDate}`);
    await expect(page.getByTestId("planner-lab-calendar")).toBeVisible();

    const dayColumn = page.locator(`[role="gridcell"][data-date="${plannerDate}"]`);
    const timeSlot = page.locator('[data-time="10:00:00"]').first();
    const [dayBox, slotBox] = await Promise.all([dayColumn.boundingBox(), timeSlot.boundingBox()]);
    expect(dayBox).not.toBeNull();
    expect(slotBox).not.toBeNull();

    await page.mouse.click(dayBox!.x + dayBox!.width / 2, slotBox!.y + slotBox!.height / 2);
    await expect(page.getByRole("status")).toHaveText("Uloženo");

    const expectedRange = getCellRangeBounds(plannerDate, 6, 9);
    await expect.poll(async () => prisma.availabilitySlot.count({
      where: {
        createdByUserId: owner.id,
        startsAt: expectedRange.startsAt,
        endsAt: expectedRange.endsAt,
      },
    })).toBe(1);
  });

  test("keeps the selected local time after the switch to daylight saving time", async ({ page }) => {
    test.skip(test.info().project.name !== "chromium", "Kliknutí do časové mřížky je pokryté desktopovým workflow.");

    const dstDate = "2027-03-29";
    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);
    await createAvailability(owner.id, 6, 8, dstDate);

    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${dstDate}`);
    await expect(page.getByTestId("planner-lab-calendar")).toBeVisible();

    const dayColumn = page.locator(`[role="gridcell"][data-date="${dstDate}"]`);
    const timeSlot = page.locator('[data-time="10:00:00"]').first();
    const [dayBox, slotBox] = await Promise.all([dayColumn.boundingBox(), timeSlot.boundingBox()]);
    expect(dayBox).not.toBeNull();
    expect(slotBox).not.toBeNull();

    await page.mouse.click(dayBox!.x + dayBox!.width / 2, slotBox!.y + slotBox!.height / 2);
    await expect(page.getByRole("status")).toHaveText("Uloženo");

    const expectedRange = getCellRangeBounds(dstDate, 6, 9);
    await expect.poll(async () => prisma.availabilitySlot.count({
      where: {
        createdByUserId: owner.id,
        startsAt: expectedRange.startsAt,
        endsAt: expectedRange.endsAt,
      },
    })).toBe(1);
  });
});
