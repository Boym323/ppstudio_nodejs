import type { NextConfig } from "next";
import path from "node:path";
import { buildSecurityHeaders } from "./src/config/security-headers";

const securityHeaders = buildSecurityHeaders({ isProduction: process.env.NODE_ENV === "production" });

const tokenRouteHeaders = [
  {
    key: "Cache-Control",
    value: "no-store",
  },
  {
    key: "Referrer-Policy",
    value: "no-referrer",
  },
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow",
  },
];

const nextConfig: NextConfig = {
  // E2E produkční build nesmí sdílet `.next` s interaktivním `next dev`.
  // Jinak build maže HMR artefakty a dev server může vracet 403 nebo spadnout.
  distDir: process.env.PPSTUDIO_NEXT_DIST_DIR || ".next",
  typescript: {
    // Next při buildování doplňuje typy z distDir do aktivního tsconfigu.
    // E2E proto používá vlastní konfiguraci a nemění tsconfig vývoje.
    tsconfigPath: process.env.PPSTUDIO_NEXT_DIST_DIR ? "tsconfig.e2e.json" : "tsconfig.json",
  },
  // Admin PWA používá scope `/admin/`; zachování koncového lomítka proto brání
  // přesměrování start_url mimo deklarovaný scope manifestu.
  skipTrailingSlashRedirect: true,
  // Každý verzovaný release obsahuje vlastní package-lock.json. Explicitní root
  // zabrání Turbopacku, aby při buildu staging release prohledával sourozence
  // v /var/www/ppstudio/releases a vypisoval falešné workspace varování.
  turbopack: {
    root: path.resolve(__dirname),
  },
  allowedDevOrigins: ["192.168.0.143", "ppstudio.cz", "www.ppstudio.cz","192.168.0.150"],
  deploymentId:
    process.env.NEXT_DEPLOYMENT_ID
    || process.env.DEPLOYMENT_VERSION
    || process.env.GIT_HASH
    || undefined,
  experimental: {
    // Tailwindovy styly jsou malé a pro první návštěvu je výhodnější je vložit
    // přímo do HTML než čekat na blokující CSS požadavky.
    inlineCss: true,
    serverActions: {
      // Media uploads are validated to 8 MB in app code, but multipart form
      // overhead would still hit the lower Next.js default request limit.
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/rezervace/storno/:path*",
        headers: tokenRouteHeaders,
      },
      {
        source: "/rezervace/sprava/:path*",
        headers: tokenRouteHeaders,
      },
      {
        source: "/rezervace/akce/:path*",
        headers: tokenRouteHeaders,
      },
      {
        source: "/admin/pozvanka/:path*",
        headers: tokenRouteHeaders,
      },
      {
        source: "/admin-sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/admin/" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
      {
        source: "/admin.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json; charset=utf-8" }],
      },
      { source: "/admin-offline.html", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
