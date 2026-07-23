import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";
import { AdminRole, EmailLogStatus, EmailLogType } from "@prisma/client";

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
    await expect(page.getByRole("heading", { name: "Události a logy" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("link", { name: "E-maily" })).toBeVisible();
    const filters = page.getByRole("button", { name: "Filtry" });
    await expect(filters).toBeVisible();
    await filters.click();
    const dialog = page.getByRole("dialog", { name: "Filtry logů" });
    await expect(dialog).toBeVisible();
    const apply = dialog.getByRole("button", { name: "Použít filtry" });
    await expect(apply).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(filters).toBeFocused();
    await expect(page.getByRole("button", { name: "Zkusit znovu" })).toBeVisible();
    const technical = page.locator("details", { hasText: "Technický stav služeb" });
    await expect(technical).not.toHaveAttribute("open", "");
  });
});
