import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";
import { AdminRole, EmailLogStatus, EmailLogType, VoucherType } from "@/generated/prisma/client";

import { createSessionToken, SESSION_COOKIE_NAME } from "../../src/lib/auth/session-token";
import { cleanupE2eData, createAdminFixture, prisma } from "./helpers/fixtures";

test.describe("mobilní Události a logy", () => {
  let runId = "";
  let admin: { email: string; password: string };

  test.beforeEach(async ({ page }) => {
    runId = `logs-${Date.now()}-${randomBytes(4).toString("hex")}`;
    admin = await createAdminFixture(runId, AdminRole.OWNER);
    await prisma.emailLog.create({ data: { type: EmailLogType.GENERIC, status: EmailLogStatus.FAILED, recipientEmail: `${runId}@example.test`, subject: `Selhaný e-mail ${runId}`, templateKey: "generic-v1", errorMessage: "E2E failure" } });
    const user = await prisma.adminUser.findUniqueOrThrow({ where: { email: admin.email }, select: { id: true, email: true, name: true, role: true } });
    const session = await createSessionToken({ sub: user.id, email: user.email, name: user.name, role: user.role });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.context().addCookies([{ name: SESSION_COOKIE_NAME, value: session, url: "http://127.0.0.1:3100" }]);
    await page.goto(`/admin/logy?view=emails&query=${runId}`);
  });

  test.afterEach(async () => cleanupE2eData(runId));

  test("drawer, akce a technický panel fungují na 390×844", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Události" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("link", { name: "E-maily" })).toBeVisible();
    await page.getByRole("button", { name: "Obnovit události" }).click();
    await expect(page.getByRole("heading", { name: "Události" })).toBeVisible();
    const filters = page.getByRole("button", { name: "Filtry" });
    await expect(filters).toBeVisible();
    await filters.click();
    const dialog = page.getByRole("dialog", { name: "Filtry událostí" });
    await expect(dialog).toBeVisible();
    const apply = dialog.getByRole("button", { name: "Použít filtry" });
    await expect(apply).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(filters).toBeFocused();
    await expect(page.getByRole("button", { name: "Zopakovat odeslání" })).toBeVisible();
    await expect(page.getByRole("article").getByText(`${runId}@example.test`)).toBeVisible();
  });
  test("historie voucherů zobrazuje denní časovou osu čitelně i na úzkém mobilu", async ({ page }) => {
    const voucher = await prisma.voucher.create({
      data: {
        code: `VISUAL-${runId}`,
        type: VoucherType.VALUE,
        originalValueCzk: 100,
        remainingValueCzk: 100,
        purchaserName: "E2E historie",
      },
    });

    try {
      await page.goto(`/admin/logy?view=events&source=voucher&query=${runId}`);
      await expect(page.getByRole("heading", { name: "Události" })).toBeVisible();
      await test.info().attach("události-historie-390", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      await expect(page.getByText("Provozní historie").last()).toBeVisible();
      await expect(page.getByRole("list", { name: /Události dne/ })).toBeVisible();
      await expect(page.getByText("1 záznam · od nejnovějších · filtrováno")).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Stránkování událostí" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Voucher vytvořen" })).toBeVisible();
      await expect(page.getByRole("list", { name: /Události dne/ }).getByText("Voucher", { exact: true })).toBeVisible();
      await page.setViewportSize({ width: 320, height: 700 });
      for (const tab of ["K vyřešení", "Historie změn", "E-maily", "Technické"]) {
        await expect(page.getByRole("navigation", { name: "Pohledy událostí" }).getByRole("link", { name: tab })).toBeInViewport();
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await test.info().attach("události-historie-320", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      if (test.info().project.name === "chromium") {
        await page.setViewportSize({ width: 1440, height: 900 });
        const desktopSearch = page.getByPlaceholder("Hledat rezervaci, voucher nebo službu…");
        const advancedFilters = page.getByText("Další filtry", { exact: true });
        await expect(advancedFilters).toBeInViewport();
        const searchBox = await desktopSearch.boundingBox();
        const advancedBox = await advancedFilters.boundingBox();
        expect(searchBox && advancedBox && Math.abs(searchBox.y - advancedBox.y) < 10).toBeTruthy();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await test.info().attach("události-historie-desktop-1440", {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
      }
    } finally {
      await prisma.voucher.delete({ where: { id: voucher.id } });
    }
  });

});
