/* PWA worker pro /admin/: ukládá jen instalační shell, nikdy HTML ani provozní data. */
const CACHE_NAME = "ppstudio-admin-shell-v2";
const SHELL_ASSETS = ["/admin-offline.html", "/pwa/admin-192.png", "/pwa/admin-512.png", "/pwa/admin-maskable-512.png"];
const PWA_ASSET_PATHS = new Set(SHELL_ASSETS.slice(1));
const isAdminNavigation = (pathname) => pathname === "/admin" || pathname.startsWith("/admin/");
const isSafeStaticAsset = (pathname) => pathname.startsWith("/_next/static/") || PWA_ASSET_PATHS.has(pathname);

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
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    const cacheControl = response.headers.get("Cache-Control") || "";
    if (response.ok && response.type !== "opaque" && !/private|no-store/i.test(cacheControl)) {
      void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    }
    return response;
  })));
});
