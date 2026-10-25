import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

import { prisma } from "../../src/lib/prisma";

test("čistý Chromium hydratuje login a rezervaci bez caret-color zásahu", async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(test.info().project.name !== "chromium", "Čistý desktopový Chromium bez rozšíření.");
  const runId = randomUUID();
  const category = await prisma.serviceCategory.create({ data: { name: "Hydratace fixture", slug: `hydration-${runId}`, isActive: true } });
  try {
    await prisma.service.create({ data: { categoryId: category.id, name: "Hydratace služba", slug: `hydration-service-${runId}`, durationMinutes: 30, priceFromCzk: 900, isActive: true, isPubliclyBookable: true } });
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (/hydration|hydrated|server rendered|didn't match/i.test(message.text())) warnings.push(message.text());
    });
    page.on("pageerror", (error) => warnings.push(error.message));
    for (const path of ["/admin/prihlaseni", "/rezervace"]) {
      const response = await page.goto(path);
      expect(response?.ok()).toBe(true);
      expect(await response!.text()).not.toMatch(/caret-color\s*:/i);
      const input = page.getByRole("textbox", { name: "E-mail", exact: true });
      await expect(input).toBeVisible();
      await input.fill("hydration@example.test");
      if (path === "/rezervace") {
        await page.getByRole("button", { name: /Hydratace služba/ }).click();
        await expect(page.getByRole("complementary")).toContainText("Hydratace služba");
        await expect(input).toHaveValue("hydration@example.test");
      }
      await input.focus();
      // Veřejný formulář před kontrolou prošel změnou stavu přes React handler.
      await expect(input).toBeFocused();
      expect(await page.locator('[style*="caret-color"]').count()).toBe(0);
      if (path === "/admin/prihlaseni") {
        await page.evaluate(() => {
          const field = document.querySelector("input")!;
          const seen: string[] = [];
          Object.assign(window, { caretMutations: seen });
          new MutationObserver((records) => {
            for (const record of records) if (record.oldValue) seen.push(record.oldValue);
          }).observe(field, { attributes: true, attributeFilter: ["style"], attributeOldValue: true });
        });
        await page.screenshot({ caret: "hide" });
        const mutations = await page.evaluate(() => (window as unknown as { caretMutations: string[] }).caretMutations);
        expect(mutations.some((style) => /caret-color: transparent !important/.test(style))).toBe(true);
        expect(await page.locator('[style*="caret-color"]').count()).toBe(0);
      }
    }
    expect(warnings).toEqual([]);
  } finally {
    await prisma.service.deleteMany({ where: { categoryId: category.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});
