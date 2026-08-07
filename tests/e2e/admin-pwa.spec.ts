import { expect, test } from "@playwright/test";

test("admin PWA assety mají bezpečné hlavičky a veřejná rezervace není v jejím scope", async ({ page, request }) => {
  const [manifest, worker, offline] = await Promise.all([
    request.get("/admin.webmanifest"),
    request.get("/admin-sw.js"),
    request.get("/admin-offline.html"),
  ]);

  expect(manifest.headers()["content-type"]).toContain("application/manifest+json");
  const manifestData = await manifest.json();
  expect(manifestData).toMatchObject({ id: "/admin/", scope: "/admin/", start_url: "/admin/" });
  expect(new URL(manifestData.start_url, "https://ppstudio.test").pathname.startsWith(manifestData.scope)).toBe(true);
  expect(worker.headers()["content-type"]).toContain("application/javascript; charset=utf-8");
  expect(worker.headers()["service-worker-allowed"]).toBe("/admin/");
  expect(worker.headers()["cache-control"]).toContain("no-store");
  expect(worker.headers()["content-security-policy"]).toBe("default-src 'self'; script-src 'self'");
  expect(await worker.text()).toContain('const CACHE_NAME = "ppstudio-admin-shell-v4"');
  expect(await offline.text()).toContain("Nejste připojeni k internetu");

  const adminStart = await request.get("/admin/", { maxRedirects: 0 });
  expect(adminStart.status()).not.toBe(404);
  expect(new URL(adminStart.headers().location ?? "/admin/", "https://ppstudio.test").pathname).toMatch(/^\/admin\//);

  for (const shortcut of manifestData.shortcuts) {
    const response = await request.get(shortcut.url, { maxRedirects: 0 });
    expect(response.status()).not.toBe(404);
    const icon = shortcut.icons[0];
    expect((await request.get(icon.src)).ok()).toBe(true);
  }

  for (const screenshot of manifestData.screenshots) {
    expect((await request.get(screenshot.src)).ok()).toBe(true);
  }

  await page.goto("/admin/prihlaseni");
  await expect(page.locator('link[rel="manifest"][href="/admin.webmanifest"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"][href="/pwa/admin-apple-touch-icon.png"]')).toHaveCount(1);
  await expect.poll(() => page.evaluate(async () => new URL((await navigator.serviceWorker.ready).scope).pathname)).toBe("/admin/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/rezervace");
  await expect(page.locator('link[rel="manifest"][href="/admin.webmanifest"]')).toHaveCount(0);
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBe(null);
});
