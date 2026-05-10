import type { NextConfig } from "next";

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
  allowedDevOrigins: ["192.168.0.143", "ppstudio.cz", "www.ppstudio.cz","192.168.0.150"],
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
        source: "/api/bookings/calendar/:path*",
        headers: tokenRouteHeaders,
      },
    ];
  },
};

export default nextConfig;
