import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

test("next config defines global and token route security headers", async () => {
  const nextConfig = (await import("../../next.config")).default;
  assert.equal(typeof nextConfig.headers, "function");
  assert.ok(nextConfig.headers);
  assert.equal(nextConfig.turbopack?.root, process.cwd());

  const headers = await nextConfig.headers();
  const globalHeaders = headers.find((entry) => entry.source === "/:path*")?.headers ?? [];
  const tokenHeaders = headers.find((entry) => entry.source === "/rezervace/akce/:path*")?.headers ?? [];

  assert.deepEqual(
    globalHeaders.map((header) => header.key),
    [
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "X-Frame-Options",
    ],
  );
  assert.ok(globalHeaders.some((header) => header.key === "X-Content-Type-Options" && header.value === "nosniff"));
  assert.ok(tokenHeaders.some((header) => header.key === "Cache-Control" && header.value === "no-store"));
  assert.ok(tokenHeaders.some((header) => header.key === "Referrer-Policy" && header.value === "no-referrer"));
});
