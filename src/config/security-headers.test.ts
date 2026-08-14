import assert from "node:assert/strict";
import test from "node:test";
import { buildSecurityHeaders } from "./security-headers";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const globalHeaderKeys = [
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-Frame-Options",
];

test("security headers include the non-production baseline", () => {
  const headers = buildSecurityHeaders({ isProduction: false });

  assert.deepEqual(headers.map((header) => header.key), globalHeaderKeys);
  assert.ok(headers.some((header) => header.key === "X-Content-Type-Options" && header.value === "nosniff"));
  assert.ok(!headers.some((header) => header.key === "Strict-Transport-Security"));
});

test("security headers include production HSTS with its configured value", () => {
  const headers = buildSecurityHeaders({ isProduction: true });

  assert.deepEqual(headers.map((header) => header.key), [...globalHeaderKeys, "Strict-Transport-Security"]);
  assert.ok(
    headers.some(
      (header) => header.key === "Strict-Transport-Security" && header.value === "max-age=31536000; includeSubDomains",
    ),
  );
});

test("next config uses environment-specific global and token route security headers", async () => {
  const nextConfig = (await import("../../next.config")).default;
  assert.equal(typeof nextConfig.headers, "function");
  assert.ok(nextConfig.headers);
  assert.equal(nextConfig.turbopack?.root, process.cwd());

  const headers = await nextConfig.headers();
  const globalHeaders = headers.find((entry) => entry.source === "/:path*")?.headers ?? [];
  const tokenHeaders = headers.find((entry) => entry.source === "/rezervace/akce/:path*")?.headers ?? [];

  assert.deepEqual(
    globalHeaders,
    buildSecurityHeaders({ isProduction: process.env.NODE_ENV === "production" }),
  );
  assert.ok(tokenHeaders.some((header) => header.key === "Cache-Control" && header.value === "no-store"));
  assert.ok(tokenHeaders.some((header) => header.key === "Referrer-Policy" && header.value === "no-referrer"));
});
