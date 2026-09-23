import { randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { AdminRole } from "@/generated/prisma/client";

import {
  cleanupE2eData,
  createAdminFixture,
  createManagedBookingFixture,
  prisma,
} from "./helpers/fixtures";

async function loginAdmin(page: Page, email: string, password: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto("/admin/prihlaseni");
    if (new URL(page.url()).pathname === "/admin") {
      return;
    }
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Heslo").fill(password);
    await page.getByRole("button", { name: "Přihlásit se" }).click();

    try {
      await expect(page).toHaveURL((url) => url.pathname === "/admin", {
        timeout: attempt === 0 ? 15_000 : 20_000,
      });
      return;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }
}

async function openBookingDetail(page: Page, bookingId: string) {
  const detailPath = `/admin/rezervace/${bookingId}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto(detailPath);

    try {
      await expect(page).toHaveURL((url) => url.pathname === detailPath, {
        timeout: attempt === 0 ? 10_000 : 20_000,
      });
      await expect(page.locator("main")).toBeVisible({
        timeout: attempt === 0 ? 10_000 : 20_000,
      });
      return;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }
}

test.describe("mobilní detail rezervace", () => {
  let runId = "";

  test.afterEach(async () => {
    if (runId) {
      await cleanupE2eData(runId);
    }
  });

  test("poznámka, platba a drawer přesunu zůstávají použitelné na 390×844", async ({ page }) => {
    test.setTimeout(90_000);
    runId = `booking-detail-mobile-${Date.now()}-${randomBytes(4).toString("hex")}`;
    const fixture = await createManagedBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.OWNER);
    runId = fixture.runId;

    await page.setViewportSize({ width: 390, height: 844 });
    await loginAdmin(page, admin.email, admin.password);

    await openBookingDetail(page, fixture.bookingId!);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.locator("details", { hasText: "Přidat poznámku" }).locator("summary").click();
    const note = `Mobilní poznámka ${fixture.runId}`;
    await page.locator('textarea[name="internalNote"]').fill(note);
    await page.getByRole("button", { name: "Přidat poznámku" }).last().click();
    await expect.poll(async () => (await prisma.booking.findUniqueOrThrow({ where: { id: fixture.bookingId } })).internalNote).toBe(note);

    const paymentPanel = page.locator("details", { hasText: "Zapsat platbu" });
    const paymentSummary = paymentPanel.locator("summary");
    await paymentSummary.click();
    if (await paymentPanel.getAttribute("open") === null) {
      await paymentSummary.press("Enter");
    }
    await expect(paymentPanel).toHaveAttribute("open", "");
    await paymentPanel.getByLabel("Částka").fill("100");
    await paymentPanel.getByLabel("Poznámka").fill(`Mobilní platba ${fixture.runId}`);
    await paymentPanel.getByRole("button", { name: "Zapsat platbu" }).click();
    await expect.poll(() => prisma.bookingPayment.count({ where: { bookingId: fixture.bookingId } })).toBe(1);

    const rescheduleTrigger = page.getByRole("button", { name: "Přesunout termín" }).first();
    await rescheduleTrigger.click();
    const rescheduleDialog = page.getByRole("dialog", { name: "Změnit termín rezervace" });
    await expect(rescheduleDialog).toBeVisible();
    const submit = page.getByRole("button", { name: /Potvrdit přesun|Přesunout termín/ }).last();
    await expect(submit).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(rescheduleDialog).toHaveCount(0);
    await expect(rescheduleTrigger).toBeFocused();
  });
});
