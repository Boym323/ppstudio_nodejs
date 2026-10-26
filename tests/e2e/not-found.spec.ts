import { expect, test } from "@playwright/test";

test.describe("vlastní PP Studio 404", () => {
  test("neexistující veřejná URL vrací 404, noindex a přístupný obsah", async ({ page }) => {
    const response = await page.goto("/e2e-adresa-ktera-neexistuje");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Ups, tahle stránka si odskočila na kosmetiku." })).toBeVisible();
    await expect(page.getByTestId("not-found-404-art")).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toHaveAttribute("content", /noindex/i);
    await expect(page.getByRole("link", { name: "Zpět na úvod" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: "Prohlédnout služby" })).toHaveAttribute("href", "/sluzby");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("neexistující detail služby používá stejnou 404 a CTA fungují", async ({ page }) => {
    const response = await page.goto("/sluzby/e2e-neexistujici-sluzba");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Ups, tahle stránka si odskočila na kosmetiku." })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toHaveAttribute("content", /noindex/i);

    await page.getByRole("link", { name: "Prohlédnout služby" }).click();
    await expect(page).toHaveURL(/\/sluzby$/);
    await page.goBack();
    await page.getByRole("link", { name: "Zpět na úvod" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("mobilní i desktopové vykreslení zůstává bez horizontálního přetečení", async ({ page }) => {
    await page.goto("/e2e-responzivni-404");

    await expect(page.getByRole("heading", { name: "Ups, tahle stránka si odskočila na kosmetiku." })).toBeVisible();
    await expect(page.getByTestId("not-found-404-art")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);

    if (test.info().project.name === "chromium") {
      await expect(page.getByRole("navigation", { name: "Hlavní navigace" })).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: "Otevřít menu" })).toBeVisible();
    }
  });

  test("admin a neplatné rezervační tokeny si zachovají vlastní chování", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/prihlaseni(?:\?.*)?$/);
    await expect(page.getByRole("heading", { name: "Přihlášení do správy salonu" })).toBeVisible();

    await page.goto("/rezervace/sprava/neplatny-e2e-token");
    await expect(page.getByRole("heading", { name: "Tuto rezervaci teď nelze změnit online." })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toHaveAttribute("content", /noindex/i);

    await page.goto("/rezervace/storno/neplatny-e2e-token");
    await expect(page.getByRole("heading", { name: "Tuhle rezervaci už nelze zrušit online." })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toHaveAttribute("content", /noindex/i);
  });
});
