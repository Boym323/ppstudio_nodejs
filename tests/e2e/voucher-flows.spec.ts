import { expect, test, type Page } from "@playwright/test";
import { AdminRole } from "@/generated/prisma/client";
import { readFile } from "node:fs/promises";

import {
  cleanupE2eData,
  createAdminFixture,
  createPublicBookingFixture,
  prisma,
  type E2eFixture,
} from "./helpers/fixtures";

async function loginAdmin(page: Page, email: string, password: string) {
  await page.goto("/admin/prihlaseni");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test.describe("administrační toky voucherů", () => {
  let fixtures: E2eFixture[] = [];

  test.afterEach(async () => {
    await Promise.all(fixtures.map((fixture) => cleanupE2eData(fixture.runId)));
    fixtures = [];
  });

  test("owner vytvoří hodnotový voucher, stáhne jeho PDF a připraví e-mail voucheru", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.OWNER);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password);
    await page.goto("/admin/vouchery/novy");

    await page.getByLabel("Hodnota v Kč").fill("1500");
    await page.getByRole("textbox", { name: "Kupující", exact: true }).fill(`E2E kupující ${fixture.runId}`);
    await page.getByLabel("E-mail kupujícího").fill(`${fixture.runId}-voucher@example.test`);
    await page
      .getByLabel("Poznámka jen pro administraci")
      .fill(`E2E voucher lifecycle ${fixture.runId}`);
    await page.getByRole("button", { name: "Vytvořit voucher" }).click();
    await expect(page).toHaveURL(/\/admin\/vouchery\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Detail voucheru" })).toBeVisible();

    const voucher = await prisma.voucher.findFirstOrThrow({
      where: {
        internalNote: {
          contains: fixture.runId,
        },
      },
      select: {
        id: true,
        code: true,
        originalValueCzk: true,
        remainingValueCzk: true,
      },
    });

    expect(voucher.originalValueCzk).toBe(1500);
    expect(voucher.remainingValueCzk).toBe(1500);
    await expect(page.getByText(voucher.code)).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Stáhnout PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const pdfPath = await download.path();
    expect(pdfPath).toBeTruthy();
    expect((await readFile(pdfPath!)).subarray(0, 4).toString()).toBe("%PDF");

    const emailPanel = page.locator("#voucher-email-panel");
    await emailPanel.getByRole("button", { name: "Poslat e-mailem" }).click();
    await expect(emailPanel.getByRole("textbox", { name: "Příjemce e-mail" }))
      .toHaveValue(`${fixture.runId}-voucher@example.test`);
    await expect(emailPanel.getByRole("textbox", { name: "Předmět" }))
      .toHaveValue("Dárkový poukaz PP Studio");
    await expect(emailPanel.getByRole("button", { name: "Potvrdit odeslání" })).toBeVisible();
  });

  test("owner vytvoří službový voucher pomocí výběru z administračního katalogu", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.OWNER);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password);
    await page.goto("/admin/vouchery/novy");

    await page.getByRole("button", { name: "Poukaz na službu" }).click();
    const serviceButton = page.locator('button[aria-pressed]').filter({ hasText: fixture.serviceName }).first();
    await expect(serviceButton).toBeVisible();
    await serviceButton.click();
    await expect(serviceButton).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("textbox", { name: "Kupující", exact: true }).fill(`E2E služba ${fixture.runId}`);
    await page.getByRole("button", { name: "Vytvořit voucher" }).click();
    await expect(page).toHaveURL(/\/admin\/vouchery\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Detail voucheru" })).toBeVisible();

    const voucher = await prisma.voucher.findFirstOrThrow({
      where: {
        purchaserName: `E2E služba ${fixture.runId}`,
      },
      select: {
        type: true,
        service: {
          select: {
            name: true,
          },
        },
      },
    });

    expect(voucher.type).toBe("SERVICE");
    expect(voucher.service?.name).toBe(fixture.serviceName);
  });
});
