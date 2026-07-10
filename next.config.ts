import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const tokenRouteHeaders = [
  {
    key: "Cache-Control",
    value: "no-store",
  },
  {
    key: "Referrer-Policy",
    value: "no-referrer",
  },
];

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
