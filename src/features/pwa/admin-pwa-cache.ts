const ADMIN_PATH_PREFIX = "/admin";
const PWA_ASSET_PATHS = new Set([
  "/pwa/admin-192.png",
  "/pwa/admin-512.png",
  "/pwa/admin-maskable-512.png",
]);

/** Only immutable build assets and deliberately public PWA icons are cacheable. */
export function isSafePwaAsset(pathname: string) {
  return pathname.startsWith("/_next/static/") || PWA_ASSET_PATHS.has(pathname);
}

export function shouldHandleAdminNavigation(pathname: string) {
  return pathname === ADMIN_PATH_PREFIX || pathname.startsWith(`${ADMIN_PATH_PREFIX}/`);
}

export function shouldBypassPwaCache(pathname: string) {
  return pathname.startsWith("/api/") || shouldHandleAdminNavigation(pathname) || !isSafePwaAsset(pathname);
}
