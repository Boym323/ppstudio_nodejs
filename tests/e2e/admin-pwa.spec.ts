import { expect, test } from "@playwright/test";

test("admin PWA assety mají bezpečné hlavičky a veřejná rezervace není v jejím scope", async ({ page, request }) => {
  const [manifest, worker, offline] = await Promise.all([
    request.get("/admin.webmanifest"),
    request.get("/admin-sw.js"),
    request.get("/admin-offline.html"),
  ]);

  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
  expect(await manifest.json()).toMatchObject({ scope: "/admin/", start_url: "/admin" });
  expect(worker.headers()["content-type"]).toContain("application/javascript; charset=utf-8");
  expect(worker.headers()["service-worker-allowed"]).toBe("/admin/");
  expect(worker.headers()["cache-control"]).toContain("no-store");
  expect(await offline.text()).toContain("Nejste připojeni k internetu");

  await page.goto("/admin/prihlaseni");
  await expect(page.locator('link[rel="manifest"][href="/admin.webmanifest"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/rezervace");
  await expect(page.locator('link[rel="manifest"][href="/admin.webmanifest"]')).toHaveCount(0);
});
