import { randomBytes } from "crypto";

import { expect, test, type Page } from "@playwright/test";
import { AdminRole, AvailabilitySlotServiceRestrictionMode, AvailabilitySlotStatus } from "@/generated/prisma/client";

import { getCellRangeBounds } from "../../src/features/admin/lib/admin-slots/time";
import { hashPassword } from "../../src/lib/auth/password";
import { prisma } from "../../src/lib/prisma";

const plannerDate = "2027-03-22";

function nextAutumnPlannerDate(now = new Date()) {
  for (let year = now.getUTCFullYear(); ; year++) {
    const monday = new Date(Date.UTC(year, 10, 1, 5));
    while (monday.getUTCDay() !== 1) monday.setUTCDate(monday.getUTCDate() - 1);
    if (monday > now) return monday.toISOString().slice(0, 10);
  }
}

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
  const grid = planner.getByRole("grid").or(planner.getByRole("table"));
  const cells = grid.locator("td, [role=\"gridcell\"], [role=\"cell\"]");
  await expect(planner).toBeVisible();
  await expect(grid).toBeVisible();
  await expect.poll(async () => cells.count()).toBeGreaterThan(0);
  await expect.poll(async () => grid.evaluate((element) => {
    const { height, width } = element.getBoundingClientRect();
    return width > 0 && height > 0;
  })).toBe(true);
}

test.describe("produkční plánovač FullCalendaru", () => {
  const runIds: string[] = [];

  test.afterEach(async () => {
    await Promise.all(runIds.splice(0).map(cleanupRun));
  });

  test("DST audit: jediné kliknutí po podzimním DST v 06:00 má jednu operaci a audit", async ({ page }) => {
    test.setTimeout(120_000);
    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);
    const dateKey = nextAutumnPlannerDate();
    let requests = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" && request.headers()["next-action"]) requests++;
    });
    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${dateKey}`);
    await expectStyledPlanner(page);
    await page.getByRole("button", { name: "Přidat termín" }).click();
    const day = await page.getByTestId("fullcalendar-planner").locator(`[data-date="${dateKey}"]`).first().boundingBox();
    const slot = await page.locator('[data-time="06:00:00"]').last().boundingBox();
    expect(day).not.toBeNull();
    expect(slot).not.toBeNull();
    if (test.info().project.use.hasTouch) await page.touchscreen.tap(day!.x + day!.width / 2, slot!.y + slot!.height / 4);
    else await page.mouse.click(day!.x + day!.width / 2, slot!.y + slot!.height / 4);
    await expect(page.getByRole("status")).toHaveText("Uloženo", { timeout: 60_000 });
    // Po serverovém refreshi je dokončená také případná druhá položka fronty.
    await expect(page.getByRole("button", { name: "Přidat termín" })).toBeEnabled();
    const audits = await prisma.availabilityAuditEvent.findMany({ where: { actorUserId: owner.id } });
    const operations = await prisma.availabilityOperation.count({ where: { operationId: { in: audits.map((audit) => audit.operationId) } } });
    console.log(JSON.stringify({ scenario: "DST single click", dateKey, requests, operations, audits: audits.length }));
    expect(requests).toBe(1);
    expect(audits).toHaveLength(1);
    expect(operations).toBe(1);
    const range = getCellRangeBounds(dateKey, 0, 1);
    expect(range.startsAt.toISOString()).toBe(`${dateKey}T05:00:00.000Z`);
    expect(range.endsAt.toISOString()).toBe(`${dateKey}T05:30:00.000Z`);
    await expect.poll(() => prisma.availabilitySlot.count({ where: { createdByUserId: owner.id, startsAt: range.startsAt, endsAt: range.endsAt } })).toBe(1);
  });

  test("pomalá síť zachová dvě gesta, drag i undo v pořadí", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(test.info().project.name !== "chromium", "Desktopový drag.");
    const runId = buildRunId(); runIds.push(runId);
    const owner = await createOwner(runId);
    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${plannerDate}`);
    await expectStyledPlanner(page);
    await page.getByRole("button", { name: "Přidat termín" }).click();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let requests = 0;
    await page.route("**/admin/volne-terminy?*", async (route) => {
      if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
        requests++;
        if (requests === 1) await gate;
      }
      await route.continue();
    });
    const day = await page.getByTestId("fullcalendar-planner").locator(`[data-date="${plannerDate}"]`).first().boundingBox();
    const first = await page.locator('[data-time="06:00:00"]').last().boundingBox();
    const x = day!.x + day!.width / 2;
    try {
      await page.mouse.click(x, first!.y + first!.height / 4);
      await expect.poll(() => requests).toBe(1);
      const second = await page.locator('[data-time="07:00:00"]').last().boundingBox();
      const end = await page.locator('[data-time="08:00:00"]').last().boundingBox();
      await page.mouse.move(x, second!.y + second!.height / 4);
      await page.mouse.down();
      await page.mouse.move(x, end!.y - 2, { steps: 12 });
      await page.mouse.up();
      expect(requests).toBe(1); // druhé gesto čeká ve FIFO, není souběžný write
    } finally { release(); }
    await expect(page.getByRole("status")).toHaveText("Uloženo", { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Následující týden" })).toBeEnabled();
    expect(requests).toBe(2);
    expect(await prisma.availabilityAuditEvent.count({ where: { actorUserId: owner.id } })).toBe(2);
    const ranges = [[0, 1], [2, 4]].map(([start, end]) => getCellRangeBounds(plannerDate, start, end));
    for (const range of ranges) expect(await prisma.availabilitySlot.count({ where: { createdByUserId: owner.id, startsAt: range.startsAt, endsAt: range.endsAt } })).toBe(1);
    await page.getByRole("button", { name: "Vrátit změnu" }).click();
    await expect(page.getByRole("status")).toHaveText("Uloženo", { timeout: 60_000 });
    expect(await prisma.availabilityAuditEvent.count({ where: { actorUserId: owner.id, operation: "UNDO" } })).toBe(1);
    expect(await prisma.availabilitySlot.count({ where: { createdByUserId: owner.id } })).toBe(1);
    const audits = await prisma.availabilityAuditEvent.findMany({ where: { actorUserId: owner.id } });
    const operations = await prisma.availabilityOperation.count({ where: { operationId: { in: audits.map((audit) => audit.operationId) } } });
    expect(requests).toBe(3);
    expect(audits).toHaveLength(3);
    expect(operations).toBe(3);
    console.log(JSON.stringify({ scenario: "queued click + drag + undo", requests, operations, audits: audits.length }));
  });

  test("retry po ztracené odpovědi nepřidá operaci ani audit", async ({ page }) => {
    test.setTimeout(120_000);
    test.skip(test.info().project.name !== "chromium", "Desktopové gesto.");
    const runId = buildRunId(); runIds.push(runId);
    const owner = await createOwner(runId);
    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${plannerDate}`);
    await expectStyledPlanner(page);
    await page.getByRole("button", { name: "Přidat termín" }).click();
    let requests = 0;
    await page.route("**/admin/volne-terminy?*", async (route) => {
      if (route.request().method() === "POST" && route.request().headers()["next-action"] && ++requests === 1) {
        await route.fetch(); // server už commitnul, klient odpověď nedostane
        await route.abort("failed");
      } else await route.continue();
    });
    const day = await page.getByTestId("fullcalendar-planner").locator(`[data-date="${plannerDate}"]`).first().boundingBox();
    const slot = await page.locator('[data-time="06:00:00"]').last().boundingBox();
    await page.mouse.click(day!.x + day!.width / 2, slot!.y + slot!.height / 4);
    await page.getByRole("button", { name: "Zkusit znovu" }).click();
    await expect(page.getByRole("status")).toHaveText("Uloženo", { timeout: 60_000 });
    const audits = await prisma.availabilityAuditEvent.findMany({ where: { actorUserId: owner.id } });
    expect(requests).toBe(2);
    expect(audits).toHaveLength(1);
    expect(await prisma.availabilityOperation.count({ where: { operationId: audits[0].operationId } })).toBe(1);
    console.log(JSON.stringify({ scenario: "lost response + retry", requests, operations: 1, audits: audits.length }));
  });

  test("vykreslí dostupnost a přejde na následující týden", async ({ page }) => {
    test.skip(test.info().project.name !== "chromium", "Scénář ověřuje desktopový pracovní týden.");

    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);
    await createAvailability(owner.id, 6, 8);

    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${plannerDate}`);

    await expect(page.getByTestId("fullcalendar-planner")).toBeVisible();
    await expect(page.getByLabel("Legenda kalendáře")).toContainText("Volný termín");
    await expect(page.getByLabel("Denní režim automatického oběda")).toBeVisible();
    await expect(page.locator(".planner-lab-event--availability").first()).toBeVisible();

    const [toolbarBox, legendBox, lunchBox, plannerBox] = await Promise.all([
      page.getByRole("button", { name: "Následující týden" }).boundingBox(),
      page.getByLabel("Legenda kalendáře").boundingBox(),
      page.getByLabel("Denní režim automatického oběda").boundingBox(),
      page.getByTestId("fullcalendar-planner").boundingBox(),
    ]);
    expect(toolbarBox).not.toBeNull();
    expect(legendBox).not.toBeNull();
    expect(lunchBox).not.toBeNull();
    expect(plannerBox).not.toBeNull();
    expect(toolbarBox!.y).toBeLessThan(legendBox!.y);
    expect(legendBox!.y).toBeLessThan(lunchBox!.y);
    expect(lunchBox!.y).toBeLessThan(plannerBox!.y);
    expect(plannerBox!.y - (lunchBox!.y + lunchBox!.height)).toBeLessThan(32);
    expect(plannerBox!.y).toBeLessThan(page.viewportSize()!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

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
    test.skip(
      !["mobile-chrome", "mobile-safari"].includes(test.info().project.name),
      "Scénář ověřuje mobilní jednodenní pohled.",
    );

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

  test("mobilní dlouhý dotyk vybere a uloží rozsah dostupnosti", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile-chrome", "Dotykové tažení ověřuje Chromium emulaci Pixelu.");
    test.setTimeout(120_000);

    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);
    await createAvailability(owner.id, 4, 28);
    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${plannerDate}&day=${plannerDate}`);
    await expectStyledPlanner(page);
    await page.getByRole("button", { name: "Přidat termín" }).click();
    const planner = page.getByTestId("fullcalendar-planner");
    await planner.evaluate((root) => {
      window.scrollTo({ top: window.scrollY + root.getBoundingClientRect().top - 100, behavior: "instant" });
    });
    const plannerBox = await planner.boundingBox();
    expect(plannerBox).not.toBeNull();
    const cdp = await page.context().newCDPSession(page);
    const swipeX = plannerBox!.x + plannerBox!.width / 2;
    const swipeY = Math.min(plannerBox!.y + plannerBox!.height - 20, page.viewportSize()!.height - 20);
    const initialPageY = await page.evaluate(() => window.scrollY);
    const swipe = async () => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: swipeX, y: swipeY, id: 1 }] });
      for (let step = 1; step <= 8; step++) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: swipeX, y: swipeY - step * 10, id: 1 }] });
        await page.waitForTimeout(20);
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(300);
    };
    await swipe();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialPageY);
    for (let attempt = 0; attempt < 8; attempt++) {
      if (await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY < 1)) break;
      await swipe();
    }
    const lastSlotBox = await page.locator('[data-time="19:30:00"]').last().boundingBox();
    expect(lastSlotBox).not.toBeNull();
    expect(lastSlotBox!.y + lastSlotBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    expect(await prisma.availabilitySlot.count({ where: { createdByUserId: owner.id } })).toBe(1);
    await planner.evaluate((root) => {
      window.scrollTo({ top: window.scrollY + root.getBoundingClientRect().top - 100, behavior: "instant" });
    });

    const day = planner.locator(`[data-date="${plannerDate}"]`).first();
    const startSlot = page.locator('[data-time="06:00:00"]').first();
    const endSlot = page.locator('[data-time="07:00:00"]').first();
    const [dayBox, startBox, endBox] = await Promise.all([day.boundingBox(), startSlot.boundingBox(), endSlot.boundingBox()]);
    expect(dayBox).not.toBeNull();
    expect(startBox).not.toBeNull();
    expect(endBox).not.toBeNull();

    const x = dayBox!.x + dayBox!.width / 2;
    const startY = startBox!.y + startBox!.height / 2;
    const endY = endBox!.y + endBox!.height / 2;
    const pageY = await page.evaluate(() => window.scrollY);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: startY, id: 1 }] });
    await page.waitForTimeout(550);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: endY, id: 1 }] });
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageY);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();

    await expect(page.getByRole("status")).toHaveText("Uloženo", { timeout: 60_000 });
    await expect.poll(() => prisma.availabilitySlot.count({ where: { createdByUserId: owner.id } })).toBe(2);
    const saved = await prisma.availabilitySlot.findFirstOrThrow({ where: { createdByUserId: owner.id }, orderBy: { startsAt: "asc" } });
    expect(saved.endsAt.getTime() - saved.startsAt.getTime()).toBeGreaterThan(30 * 60_000);
    expect(await prisma.availabilityAuditEvent.count({ where: { actorUserId: owner.id } })).toBe(1);
  });

  for (const { label, width, height } of [{ label: "telefon", width: 402, height: 681 }, { label: "tablet", width: 834, height: 1194 }]) {
    test(`${label}: poslední půlhodinu dne lze zobrazit a uložit dotykem`, async ({ page }) => {
      test.skip(!["mobile-chrome", "mobile-safari"].includes(test.info().project.name) || (label === "tablet" && test.info().project.name !== "mobile-safari"), "Scénář ověřuje dotykové rozměry telefonu a tabletu.");
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height });
      const runId = buildRunId();
      runIds.push(runId);
      const owner = await createOwner(runId);
      await loginAdmin(page, owner.email, owner.password);
      await page.goto(`/admin/volne-terminy?week=${plannerDate}&day=${plannerDate}`);
      const planner = page.getByTestId("fullcalendar-planner");
      await expectStyledPlanner(page);
      await page.getByRole("button", { name: "Přidat termín" }).tap();
      const nestedScrollers = await planner.evaluate((root) => [...root.querySelectorAll<HTMLElement>("*")].filter((element) => ["auto", "scroll"].includes(getComputedStyle(element).overflowY)).length);
      expect(nestedScrollers).toBe(0);
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
      const slot = page.locator('[data-time="19:30:00"]').last();
      const [dayBox, slotBox] = await Promise.all([planner.locator(`[data-date="${plannerDate}"]`).first().boundingBox(), slot.boundingBox()]);
      expect(dayBox).not.toBeNull();
      expect(slotBox).not.toBeNull();
      const x = dayBox!.x + dayBox!.width / 2;
      const y = slotBox!.y + slotBox!.height / 4;
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(height);
      expect(await planner.evaluate((root, point) => root.contains(document.elementFromPoint(point.x, point.y)), { x, y })).toBe(true);
      await page.touchscreen.tap(x, y);
      await expect(page.getByRole("status")).toHaveText("Uloženo", { timeout: 60_000 });
      expect(await planner.evaluate((root) => [...root.querySelectorAll<HTMLElement>("*")].filter((element) => ["auto", "scroll"].includes(getComputedStyle(element).overflowY)).length)).toBe(0);
      const range = getCellRangeBounds(plannerDate, 27, 28);
      await expect.poll(() => prisma.availabilitySlot.count({ where: { createdByUserId: owner.id, startsAt: range.startsAt, endsAt: range.endsAt } })).toBe(1);
    });
  }

  test("prohlížení nemění dostupnost a přidávací režim ji uloží s undo", async ({ page }) => {
    test.skip(test.info().project.name !== "chromium", "Kliknutí do časové mřížky je pokryté desktopovým workflow.");

    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);
    await createAvailability(owner.id, 6, 8);

    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${plannerDate}`);
    await expect(page.getByTestId("fullcalendar-planner")).toBeVisible();

    const dayColumn = page.getByTestId("fullcalendar-planner").locator(`[data-date="${plannerDate}"]`).first();
    const timeSlot = page.locator('[data-time="10:00:00"]').first();
    const [dayBox, slotBox] = await Promise.all([dayColumn.boundingBox(), timeSlot.boundingBox()]);
    expect(dayBox).not.toBeNull();
    expect(slotBox).not.toBeNull();

    await page.mouse.click(dayBox!.x + dayBox!.width / 2, slotBox!.y + slotBox!.height / 2);
    const expectedRange = getCellRangeBounds(plannerDate, 6, 9);
    await expect.poll(async () => prisma.availabilitySlot.count({ where: { createdByUserId: owner.id, startsAt: expectedRange.startsAt, endsAt: expectedRange.endsAt } })).toBe(0);

    await page.getByRole("button", { name: "Přidat termín" }).click();
    await page.mouse.click(dayBox!.x + dayBox!.width / 2, slotBox!.y + slotBox!.height / 2);
    await expect(page.getByRole("status")).toHaveText("Uloženo", { timeout: 60_000 });

    await expect.poll(async () => prisma.availabilitySlot.count({
      where: {
        createdByUserId: owner.id,
        startsAt: expectedRange.startsAt,
      },
    })).toBe(1);
    await page.getByRole("button", { name: "Vrátit změnu" }).click();
    await expect.poll(async () => prisma.availabilitySlot.count({ where: { createdByUserId: owner.id, startsAt: expectedRange.startsAt, endsAt: expectedRange.endsAt } })).toBe(0);
  });

  test("zachová vybraný místní čas po přechodu na letní čas", async ({ page }) => {
    test.skip(test.info().project.name !== "chromium", "Kliknutí do časové mřížky je pokryté desktopovým workflow.");

    const dstDate = "2027-03-29";
    const runId = buildRunId();
    runIds.push(runId);
    const owner = await createOwner(runId);
    await createAvailability(owner.id, 6, 8, dstDate);

    await loginAdmin(page, owner.email, owner.password);
    await page.goto(`/admin/volne-terminy?week=${dstDate}`);
    await expect(page.getByTestId("fullcalendar-planner")).toBeVisible();

    const dayColumn = page.getByTestId("fullcalendar-planner").locator(`[data-date="${dstDate}"]`).first();
    const timeSlot = page.locator('[data-time="10:00:00"]').first();
    const [dayBox, slotBox] = await Promise.all([dayColumn.boundingBox(), timeSlot.boundingBox()]);
    expect(dayBox).not.toBeNull();
    expect(slotBox).not.toBeNull();

    await page.getByRole("button", { name: "Přidat termín" }).click();
    await page.mouse.click(dayBox!.x + dayBox!.width / 2, slotBox!.y + slotBox!.height + 2);
    await expect(page.getByRole("status")).toHaveText("Uloženo", { timeout: 60_000 });

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
