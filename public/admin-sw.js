/* PWA worker pro /admin/: ukládá jen instalační shell, nikdy HTML ani provozní data. */
const CACHE_NAME = "ppstudio-admin-shell-v3";
const SHELL_ASSETS = ["/admin-offline.html", "/pwa/admin-192.png", "/pwa/admin-512.png", "/pwa/admin-maskable-512.png"];
const PWA_ASSET_PATHS = new Set(SHELL_ASSETS.slice(1));
const isAdminNavigation = (pathname) => pathname === "/admin" || pathname.startsWith("/admin/");
const isSafeStaticAsset = (pathname) => pathname.startsWith("/_next/static/") || PWA_ASSET_PATHS.has(pathname);
const cacheResponseSafely = async (cache, request, networkResponse) => {
  if (!networkResponse.ok || networkResponse.type === "opaque" || networkResponse.bodyUsed) return;

  try {
    // Clone synchronously before returning the original response to the browser.
    await cache.put(request, networkResponse.clone());
  } catch {
    // Cache Storage is only an optimization; never turn a successful fetch into a failure.
  }
};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("ppstudio-admin-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  // Network-first admin HTML deliberately never reaches Cache Storage.
  if (request.mode === "navigate" && isAdminNavigation(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match("/admin-offline.html")));
    return;
  }
  // Only public, immutable assets are cacheable; private and no-store responses are rejected.
  if (!isSafeStaticAsset(url.pathname)) return;
  event.respondWith(caches.match(request).then(async (cached) => {
    if (cached) return cached;

    const networkResponse = await fetch(request);
    const cacheControl = networkResponse.headers.get("Cache-Control") || "";
    if (!/private|no-store/i.test(cacheControl)) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cacheResponseSafely(cache, request, networkResponse);
      } catch {
        // Opening Cache Storage can fail as well; the network response still wins.
      }
    }

    return networkResponse;
  }));
});
