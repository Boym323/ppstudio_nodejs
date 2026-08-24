import { expect, test, type Page } from "@playwright/test";
import { AdminRole } from "@/generated/prisma/client";

import {
  cleanupE2eData,
  createAdminFixture,
  createPublicBookingFixture,
  type E2eFixture,
} from "./helpers/fixtures";

async function loginAdmin(
  page: Page,
  email: string,
  password: string,
  expectedPath: "/admin" | "/admin/provoz",
) {
  await page.goto("/admin/prihlaseni");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL((url) => url.pathname === expectedPath);
}

async function expectPageReady(page: Page, path: string, heading: RegExp | string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute("content", /noindex/i);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const currentUrl = new URL(page.url());
  const expectedCanonicalPath = currentUrl.pathname === "/" ? "" : currentUrl.pathname;
  const canonical = page.locator('link[rel="canonical"]');
  const canonicalHref = await canonical.getAttribute("href");

  expect(canonicalHref).toBeTruthy();
  expect(canonicalHref).not.toContain("http://ppstudio.cz");
  expect(new URL(canonicalHref ?? "https://invalid.example").pathname).toBe(expectedCanonicalPath || "/");
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", canonicalHref ?? "");
}

test.describe("základní pokrytí veřejného webu", () => {
  let fixtures: E2eFixture[] = [];

  test.afterEach(async () => {
    await Promise.all(fixtures.map((fixture) => cleanupE2eData(fixture.runId)));
    fixtures = [];
  });

  test("veřejný návštěvník otevře všechny hlavní veřejné stránky a detail služby", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    fixtures.push(fixture);

    const publicPages: Array<{ path: string; heading: RegExp | string }> = [
      { path: "/", heading: "Kosmetika ve Zlíně" },
      { path: "/sluzby", heading: "Péče rozdělená podle toho, co právě hledáte." },
      { path: "/cenik", heading: "Ceny přehledně a bez zbytečného hledání." },
      { path: "/o-mne", heading: "Péče, ve které se můžete cítit dobře" },
      { path: "/studio", heading: "Klidné místo pro vaši péči" },
      { path: "/kontakt", heading: "Pokud si nejste jistá, napište mi." },
      { path: "/faq", heading: "Odpovědi na otázky, které klientce pomáhají rozhodnout se bez nejistoty." },
      { path: "/storno-podminky", heading: /storno/i },
      { path: "/obchodni-podminky", heading: /obchodní podmínky/i },
      { path: "/gdpr", heading: /gdpr|osobních údajů/i },
      { path: `/sluzby/${fixture.serviceSlug}`, heading: fixture.serviceName },
    ];

    for (const item of publicPages) {
      await expectPageReady(page, item.path, item.heading);
      await expect(page.getByRole("link", { name: /Rezervace|Rezervovat|Vybrat termín|Najít volný termín/i }).first())
        .toBeVisible();
    }

    await page.goto("/o-salonu");
    await expect(page).toHaveURL(/\/o-mne/);
    await expect(page.getByRole("heading", { name: "Péče, ve které se můžete cítit dobře" })).toBeVisible();

    await page.goto("/vouchery/overeni");
    await expect(page.getByRole("heading", { name: "Ověření dárkového poukazu" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);
  });

  test("mobilní navigace zůstane přístupná a po změně velikosti z desktopu odemkne stránku", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile-chrome", "Scénář ověřuje mobilní veřejnou navigaci.");

    await page.goto("/");

    const menuButton = page.getByRole("button", { name: "Otevřít menu" });
    await expect(menuButton).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await menuButton.click();
    await expect(page.getByRole("navigation", { name: "Mobilní navigace" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Mobilní navigace" })).toHaveCount(0);
    await expect(menuButton).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");

    await menuButton.click();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("navigation", { name: "Mobilní navigace" })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("technické veřejné routy pro vyhledávače zůstanou dostupné a skryjí privátní cesty", async ({ request }) => {
    const [robotsResponse, sitemapResponse] = await Promise.all([
      request.get("/robots.txt"),
      request.get("/sitemap.xml"),
    ]);

    expect(robotsResponse.ok()).toBe(true);
    expect(sitemapResponse.ok()).toBe(true);

    const robots = await robotsResponse.text();
    const sitemap = await sitemapResponse.text();
    const sitemapUrl = robots.match(/^Sitemap: (.+)$/m)?.[1];
    const canonicalUrl = sitemapUrl?.replace(/\/sitemap\.xml$/, "");

    expect(sitemapUrl).toBeTruthy();
    expect(canonicalUrl).toBeTruthy();

    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /rezervace/sprava");
    expect(robots).not.toMatch(/^Host:/m);
    expect(sitemapUrl).toBe(`${canonicalUrl}/sitemap.xml`);
    expect(canonicalUrl).not.toBe("http://ppstudio.cz");
    expect(sitemap).toContain("<loc>");
    expect(sitemap).toContain(`<loc>${canonicalUrl}`);
    expect(sitemap).toContain("/sluzby");
    expect(sitemap).toContain(`${canonicalUrl}/studio`);
    expect(sitemap).not.toContain("http://ppstudio.cz");
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/rezervace/sprava");
  });

  test("veřejné chybové stránky a privátní obslužné routy se chovají bezpečně při chybě", async ({ page }) => {
    await page.goto("/sluzby/neexistujici-e2e-sluzba");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

    await page.goto("/rezervace/sprava/neplatny-e2e-token");
    await expect(page.getByRole("heading", { name: "Tuto rezervaci teď nelze změnit online." }))
      .toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);

    await page.goto("/rezervace/storno/neplatny-e2e-token");
    await expect(page.getByRole("heading", { name: "Tuhle rezervaci už nelze zrušit online." }))
      .toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);

    await page.goto("/admin/vouchery/neexistujici-e2e-voucher/pdf");
    await expect(page).toHaveURL(/\/admin\/prihlaseni/);
    await expect(page.getByRole("heading", { name: "Přihlášení do správy salonu" })).toBeVisible();
  });
});

test.describe("základní pokrytí administračního webu", () => {
  let fixtures: E2eFixture[] = [];

  test.afterEach(async () => {
    await Promise.all(fixtures.map((fixture) => cleanupE2eData(fixture.runId)));
    fixtures = [];
  });

  test("nepřihlášený uživatel je z chráněných pracovních prostor ownera a salonu přesměrován", async ({ page }) => {
    for (const path of ["/admin", "/admin/rezervace", "/admin/statistiky", "/admin/provoz", "/admin/provoz/rezervace", "/admin/provoz/statistiky"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/prihlaseni/);
      await expect(page.getByRole("heading", { name: "Přihlášení do správy salonu" })).toBeVisible();
    }
  });

  test("owner otevře hlavní sekce backoffice", async ({ page }) => {
    test.setTimeout(90_000);

    const fixture = await createPublicBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.OWNER);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password, "/admin");

    const ownerPages: Array<{ path: string; heading: RegExp | string }> = [
      { path: "/admin", heading: "Provozní přehled" },
      { path: "/admin/statistiky", heading: "KPI a statistiky" },
      { path: "/admin/rezervace", heading: "Rezervace" },
      { path: "/admin/volne-terminy", heading: "Volné termíny" },
      { path: "/admin/vouchery", heading: "Vouchery" },
      { path: "/admin/vouchery/novy", heading: "Vytvořit voucher" },
      { path: "/admin/klienti", heading: "Klienti" },
      { path: "/admin/media", heading: "Média" },
      { path: "/admin/sluzby", heading: "Služby" },
      { path: "/admin/kategorie-sluzeb", heading: "Kategorie služeb" },
      { path: "/admin/uzivatele", heading: "Přístupy" },
      { path: "/admin/email-logy", heading: "Události a logy" },
      { path: "/admin/nastaveni", heading: "Nastavení" },
    ];

    for (const item of ownerPages) {
      await page.goto(item.path);
      await expect(page.getByRole("heading", { name: item.heading }).first()).toBeVisible();
      if (item.path === "/admin/volne-terminy") {
        await expect(page.getByTestId("fullcalendar-planner")).toBeVisible();
      }
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);
    }

    for (const path of ["/admin/volne-terminy/novy", "/admin/volne-terminy/lab", "/admin/volne-terminy/puvodni-planner"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    }
  });

  test("KPI filtr přepíná rychlé a vlastní období bez nechtěného přepočtu", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.OWNER);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password, "/admin");
    await page.goto("/admin/statistiky?period=this_year");
    await expect(page.getByRole("main").getByText(/^Zobrazené období:/)).toBeVisible();
    await expect(page.getByLabel("Od", { exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: "Tento měsíc" }).click();
    await expect(page).toHaveURL(/period=this_month/);
    await expect(page.getByLabel("Od", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Vlastní období" }).click();
    await expect(page.getByLabel("Od", { exact: true })).toHaveValue(/\d{4}-\d{2}-\d{2}/);
    await expect(page.getByLabel("Do", { exact: true })).toHaveValue(/\d{4}-\d{2}-\d{2}/);
    await page.getByLabel("Od", { exact: true }).fill("2026-07-20");
    await page.getByLabel("Do", { exact: true }).fill("2026-07-10");
    await page.getByRole("button", { name: "Použít vlastní období" }).click();
    await expect(page.getByText("Datum „Od“ musí být před datem „Do“ nebo stejné.", { exact: true })).toBeVisible();

    await page.getByLabel("Od", { exact: true }).fill("2026-07-10");
    await page.getByLabel("Do", { exact: true }).fill("2026-07-19");
    await page.getByRole("button", { name: "Použít vlastní období" }).click();
    await expect(page).toHaveURL(/period=custom&dateFrom=2026-07-10&dateTo=2026-07-19/);
    await page.reload();
    await expect(page.getByLabel("Od", { exact: true })).toHaveValue("2026-07-10");
    await expect(page.getByLabel("Do", { exact: true })).toHaveValue("2026-07-19");
    expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("provozní KPI zachovají tmavý administrativní povrch", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.SALON);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password, "/admin/provoz");
    await page.goto("/admin/provoz/statistiky");
    await expect(page.getByRole("heading", { name: "KPI a statistiky" })).toBeVisible();
    await expect.poll(() => page.locator("main").evaluate((element) => getComputedStyle(element.parentElement?.parentElement ?? element).backgroundColor)).toBe("rgb(16, 15, 17)");
  });

  test("role salon otevře provozní pracovní prostor, ale ne sekce pouze pro ownera", async ({ page }) => {
    test.setTimeout(90_000);

    const fixture = await createPublicBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.SALON);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password, "/admin/provoz");

    const salonPages: Array<{ path: string; heading: RegExp | string }> = [
      { path: "/admin/provoz", heading: "Provozní přehled" },
      { path: "/admin/provoz/statistiky", heading: "KPI a statistiky" },
      { path: "/admin/provoz/rezervace", heading: "Rezervace" },
      { path: "/admin/provoz/volne-terminy", heading: "Volné termíny" },
      { path: "/admin/provoz/vouchery", heading: "Vouchery" },
      { path: "/admin/provoz/vouchery/novy", heading: "Vytvořit voucher" },
      { path: "/admin/provoz/klienti", heading: "Klienti" },
      { path: "/admin/provoz/media", heading: "Média" },
      { path: "/admin/provoz/sluzby", heading: "Služby" },
      { path: "/admin/provoz/kategorie-sluzeb", heading: "Kategorie služeb" },
    ];

    for (const item of salonPages) {
      await page.goto(item.path);
      await expect(page.getByRole("heading", { name: item.heading }).first()).toBeVisible();
      if (item.path === "/admin/provoz/volne-terminy") {
        await expect(page.getByTestId("fullcalendar-planner")).toBeVisible();
      }
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);
    }

    await page.goto("/admin/provoz/volne-terminy/novy");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();

    await page.goto("/admin/provoz/statistiky");
    await expect.poll(() => page.locator("main").evaluate((element) => getComputedStyle(element.parentElement?.parentElement ?? element).backgroundColor)).toBe("rgb(16, 15, 17)");

    await page.goto("/admin/nastaveni");
    await expect(page).toHaveURL(/\/admin\/provoz/);
    await expect(page.getByRole("heading", { name: "Provozní přehled" })).toBeVisible();
  });
});
