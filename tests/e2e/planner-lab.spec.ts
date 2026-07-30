import { randomBytes } from "crypto";

import { expect, test, type Page } from "@playwright/test";
import { AdminRole, AvailabilitySlotServiceRestrictionMode, AvailabilitySlotStatus } from "@prisma/client";

import { getCellRangeBounds } from "../../src/features/admin/lib/admin-slots/time";
import { hashPassword } from "../../src/lib/auth/password";
import { prisma } from "../../src/lib/prisma";

const plannerDate = "2027-03-22";

function buildRunId() {
  return `e2e-fullcalendar-planner-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

async function loginAdmin(page: Page, email: string, password: string) {
  await page.goto("/admin/prihlaseni");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/admin(?:\?.*)?$/);
}

async function createOwner(runId: string) {
  const password = "PlannerLab!123";
  const user = await prisma.adminUser.create({
    data: {
      email: `${runId}@example.test`,
      passwordHash: await hashPassword(password),
      name: `FullCalendar planner ${runId}`,
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

async function expectStyledPlanner(page: Page) {
  const planner = page.getByTestId("fullcalendar-planner");
  const grid = planner.getByRole("grid");
  await expect(planner).toBeVisible();
  await expect(grid).toBeVisible();
  await expect.poll(async () => grid.getByRole("gridcell").count()).toBeGreaterThan(0);
  await expect.poll(async () => grid.evaluate((element) => {
    const { height, width } = element.getBoundingClientRect();
    return width > 0 && height > 0;
  })).toBe(true);
}

test.describe("produkční FullCalendar planner", () => {
  const runIds: string[] = [];

  test.afterEach(async () => {
    await Promise.all(runIds.splice(0).map(cleanupRun));
  });

  test("renders availability and navigates to the following week", async ({ page }) => {
    test.skip(test.info().project.name !== "chromium", "Scénář ověřuje desktopový pracovní týden.");

    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);
    await createAvailability(owner.id, 6, 8);

    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${plannerDate}`);

    await expect(page.getByTestId("fullcalendar-planner")).toBeVisible();
    await expect(page.getByLabel("Legenda kalendáře")).toContainText("Volný termín");
    await expect(page.locator(".planner-lab-event--availability").first()).toBeVisible();

    await page.getByRole("button", { name: "Následující týden" }).click();
    await expect(page).toHaveURL(/week=2027-03-29/);
  });

  test("OWNER a SALON načtou stylovaný planner při přímém otevření", async ({ page }) => {
    test.skip(test.info().project.name !== "chromium", "Scénář ověřuje desktopovou FullCalendar mřížku.");

    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);

    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/provoz/volne-terminy?week=${plannerDate}`);
    await expectStyledPlanner(page);

    await page.goto(`/admin/volne-terminy?week=${plannerDate}`);
    await expectStyledPlanner(page);

    await page.goto("/admin/provoz/statistiky");
    await expect(page.getByRole("heading", { name: "KPI a statistiky" })).toBeVisible();
    await page.goto(`/admin/provoz/volne-terminy?week=${plannerDate}`);
    await expectStyledPlanner(page);
  });

  test("v jednodenním mobilním pohledu šipka přejde na následující den", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile-chrome", "Scénář ověřuje mobilní jednodenní pohled.");

    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);
    await createAvailability(owner.id, 6, 8);

    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${plannerDate}&day=${plannerDate}`);
    await expect(page.getByTestId("fullcalendar-planner")).toBeVisible();
    await expect(page.getByRole("button", { name: "Den", exact: true })).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Následující den" }).click();
    await expect(page).toHaveURL(/week=2027-03-22&day=2027-03-23/);

    await page.getByRole("button", { name: "Po–Pá", exact: true }).click();
    await expect(page.getByRole("button", { name: "Následující týden" })).toBeVisible();
    await page.getByRole("button", { name: "Následující týden" }).click();
    await expect(page).toHaveURL(/week=2027-03-29&day=2027-03-29/);
  });

  test("prohlížení nemění dostupnost a přidávací režim ji uloží s undo", async ({ page }) => {
    test.skip(test.info().project.name !== "chromium", "Kliknutí do časové mřížky je pokryté desktopovým workflow.");

    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);
    await createAvailability(owner.id, 6, 8);

    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${plannerDate}`);
    await expect(page.getByTestId("fullcalendar-planner")).toBeVisible();

    const dayColumn = page.locator(`[role="gridcell"][data-date="${plannerDate}"]`);
    const timeSlot = page.locator('[data-time="10:00:00"]').first();
    const [dayBox, slotBox] = await Promise.all([dayColumn.boundingBox(), timeSlot.boundingBox()]);
    expect(dayBox).not.toBeNull();
    expect(slotBox).not.toBeNull();

    await page.mouse.click(dayBox!.x + dayBox!.width / 2, slotBox!.y + slotBox!.height / 2);
    const expectedRange = getCellRangeBounds(plannerDate, 6, 9);
    await expect.poll(async () => prisma.availabilitySlot.count({ where: { createdByUserId: owner.id, startsAt: expectedRange.startsAt, endsAt: expectedRange.endsAt } })).toBe(0);

    await page.getByRole("button", { name: "Přidat termín" }).click();
    await page.mouse.click(dayBox!.x + dayBox!.width / 2, slotBox!.y + slotBox!.height / 2);
    await expect(page.getByRole("status")).toHaveText("Uloženo");

    await expect.poll(async () => prisma.availabilitySlot.count({
      where: {
        createdByUserId: owner.id,
        startsAt: expectedRange.startsAt,
      },
    })).toBe(1);
    await page.getByRole("button", { name: "Vrátit změnu" }).click();
    await expect.poll(async () => prisma.availabilitySlot.count({ where: { createdByUserId: owner.id, startsAt: expectedRange.startsAt, endsAt: expectedRange.endsAt } })).toBe(0);
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
    await expect(page.getByTestId("fullcalendar-planner")).toBeVisible();

    const dayColumn = page.locator(`[role="gridcell"][data-date="${dstDate}"]`);
    const timeSlot = page.locator('[data-time="10:00:00"]').first();
    const [dayBox, slotBox] = await Promise.all([dayColumn.boundingBox(), timeSlot.boundingBox()]);
    expect(dayBox).not.toBeNull();
    expect(slotBox).not.toBeNull();

    await page.getByRole("button", { name: "Přidat termín" }).click();
    await page.mouse.click(dayBox!.x + dayBox!.width / 2, slotBox!.y + slotBox!.height + 2);
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
