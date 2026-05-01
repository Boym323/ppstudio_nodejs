import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
process.env.NEXT_PUBLIC_SITE_DOMAIN = "ppstudio.cz";
process.env.VOUCHER_PUBLIC_DOMAIN = "vouchery.ppstudio.cz";
Object.assign(process.env, { NODE_ENV: "production" });

test("buildAbsoluteUrl rejects untrusted forwarded hosts", async () => {
  const { buildAbsoluteUrl } = await import("./request-origin");
  const request = new Request("https://example.com/api/auth/login", {
    headers: {
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    },
  });

  assert.equal(
    buildAbsoluteUrl(request, "/admin/prihlaseni?error=invalid_credentials").href,
    "https://example.com/admin/prihlaseni?error=invalid_credentials",
  );
});

test("buildAbsoluteUrl accepts configured forwarded host", async () => {
  const { buildAbsoluteUrl } = await import("./request-origin");
  const request = new Request("https://internal.example/api/auth/login", {
    headers: {
      "x-forwarded-host": "ppstudio.cz",
      "x-forwarded-proto": "https",
    },
  });

  assert.equal(buildAbsoluteUrl(request, "/admin").href, "https://ppstudio.cz/admin");
});

test("buildAbsoluteUrl falls back to canonical origin for untrusted request host", async () => {
  const { buildAbsoluteUrl } = await import("./request-origin");
  const request = new Request("https://evil.example/admin/rezervace");

  assert.equal(
    buildAbsoluteUrl(request, "/admin/prihlaseni?next=%2Fadmin%2Frezervace").href,
    "https://example.com/admin/prihlaseni?next=%2Fadmin%2Frezervace",
  );
});
