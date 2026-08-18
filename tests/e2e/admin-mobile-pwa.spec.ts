import { randomBytes } from "crypto";

import { expect, test, type Page } from "@playwright/test";
import { AdminRole } from "@/generated/prisma/client";

import { createSessionToken, SESSION_COOKIE_NAME } from "../../src/lib/auth/session-token";
import { cleanupE2eData, createAdminFixture, prisma } from "./helpers/fixtures";

const mobileViewport = { width: 390, height: 844 };

async function loginAdmin(page: Page, email: string, password: string) {
  await page.goto("/admin/prihlaseni");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Provozní přehled" })).toBeVisible();
}

async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe("mobilní a standalone admin PWA", () => {
  let runId = "";
  let admin: { email: string; password: string };

  test.beforeEach(async ({ page }) => {
    runId = `mobile-pwa-${Date.now()}-${randomBytes(4).toString("hex")}`;
    admin = await createAdminFixture(runId, AdminRole.OWNER);
    await page.setViewportSize(mobileViewport);
    await loginAdmin(page, admin.email, admin.password);
  });

  test.afterEach(async () => {
    await cleanupE2eData(runId);
  });

  test("přihlášení a přehled fungují na 390×844 bez přetečení", async ({ page, request }) => {
    await expectNoPageOverflow(page);

    const manifest = await request.get("/admin.webmanifest");
    expect((await manifest.json()).display).toBe("standalone");

    for (const width of [375, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByRole("heading", { name: "Provozní přehled" })).toBeVisible();
      await expectNoPageOverflow(page);
    }
  });

  test("otevře a zavře mobilní navigaci", async ({ page }) => {
    const menu = page.getByRole("button", { name: "Menu" });
    await menu.click();
    const navigation = page.getByRole("dialog", { name: "Mobilní navigace administrace" });
    await expect(navigation).toBeVisible();
    const close = navigation.getByRole("button", { name: "Zavřít" });
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(navigation.getByRole("button", { name: "Odhlásit se" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(navigation).toHaveCount(0);
    await expect(menu).toBeFocused();
  });

  test("KPI dashboard nepřetéká vodorovně přes celou stránku", async ({ page }) => {
    await page.goto("/admin/statistiky");
    await expect(page.getByRole("heading", { name: "KPI a statistiky" })).toBeVisible();
    await expectNoPageOverflow(page);
    await expect(page.getByRole("table").first()).toBeVisible();
  });

  test("otevře a zavře mobilní dialog", async ({ page }) => {
    await page.goto("/admin/uzivatele");
    const trigger = page.getByRole("button", { name: "Pozvat uživatele" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Pozvat uživatele" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Zavřít" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("zobrazí offline banner a propadlou session přesměruje na přihlášení", async ({ page }) => {
    await page.context().setOffline(true);
    await expect(page.getByRole("status")).toHaveText("Jste offline. Změny rezervací nejsou dostupné.");
    await page.context().setOffline(false);

    const user = await prisma.adminUser.findUniqueOrThrow({
      where: { email: admin.email },
      select: { id: true, email: true, name: true, role: true },
    });
    const expiredSession = await createSessionToken(
      { sub: user.id, email: user.email, name: user.name, role: user.role },
      { nowEpochSeconds: Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 20 },
    );
    await page.context().addCookies([
      { name: SESSION_COOKIE_NAME, value: expiredSession, url: page.url() },
    ]);

    await page.goto("/admin/statistiky");
    await expect(page).toHaveURL(/\/admin\/prihlaseni\?next=%2Fadmin%2Fstatistiky$/);
  });
});
