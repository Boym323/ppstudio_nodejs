import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { AdminRole } from "@prisma/client";

import {
  cleanupE2eData,
  createAdminFixture,
  createPublicBookingFixture,
  type E2eFixture,
} from "./helpers/fixtures";

async function loginAdmin(page: Page, email: string, password: string) {
  await page.goto("/admin/prihlaseni");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

async function expectNoAccessibilityViolations(page: Page, include?: string) {
  const builder = new AxeBuilder({ page });
  if (include) builder.include(include);
  const results = await builder.analyze();

  expect(results.violations).toEqual([]);
}

test.describe("accessibility", () => {
  let fixtures: E2eFixture[] = [];

  test.afterEach(async () => {
    await Promise.all(fixtures.map((fixture) => cleanupE2eData(fixture.runId)));
    fixtures = [];
  });

  test("public homepage has no axe violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Kosmetika ve Zlíně" })).toBeVisible();

    await expectNoAccessibilityViolations(page);
  });

  test("booking form has no axe violations", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    fixtures.push(fixture);

    await page.goto(`/rezervace?service=${fixture.serviceSlug}`);
    await expect(page.getByText(fixture.serviceName).first()).toBeVisible();

    await expectNoAccessibilityViolations(page);
  });

  test("admin dashboard has no axe violations", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.OWNER);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password);
    await expect(page.getByRole("heading", { name: "Provozní přehled" })).toBeVisible();

    await expectNoAccessibilityViolations(page);
  });

  test("admin Radix dialog and dropdown menu have no axe violations and restore focus", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.OWNER);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password);
    await page.goto("/admin/uzivatele");

    const inviteTrigger = page.getByRole("button", { name: "Pozvat uživatele" });
    await inviteTrigger.click();
    const dialog = page.getByRole("dialog", { name: "Pozvat uživatele" });
    await expect(dialog).toBeVisible();
    await expectNoAccessibilityViolations(page, '[role="dialog"]');
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(inviteTrigger).toBeFocused();

    await page.goto("/admin/sluzby");
    const menuTrigger = page.getByRole("button", { name: "Akce služby" }).first();
    await menuTrigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await page.keyboard.press("ArrowDown");
    const focusedMenuItem = menu.locator('[role="menuitem"]:focus');
    await expect(focusedMenuItem).toHaveCount(1);
    const firstFocusedLabel = await focusedMenuItem.textContent();
    await page.keyboard.press("ArrowDown");
    await expect(focusedMenuItem).toHaveCount(1);
    expect(await focusedMenuItem.textContent()).not.toBe(firstFocusedLabel);
    await expectNoAccessibilityViolations(page, '[role="menu"]');
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(menuTrigger).toBeFocused();
  });
});
