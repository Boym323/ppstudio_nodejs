import assert from "node:assert/strict";
import test from "node:test";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const cookieName = "ppstudio-admin-session";

async function createValidSessionToken(expiresIn = "1h", sessionStartedAt?: number) {
  const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
  const token = new SignJWT({
    sub: "admin-1",
    email: "owner@example.com",
    name: "Owner",
    role: "OWNER",
    ...(typeof sessionStartedAt === "number" ? { sessionStartedAt } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt();

  return token.setExpirationTime(expiresIn).sign(secret);
}

test("proxy redirects to login when admin session cookie is missing", async () => {
  const { proxy } = await import("./proxy");
  const request = new NextRequest("https://example.com/admin/rezervace");

  const response = await proxy(request);

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://example.com/admin/prihlaseni?next=%2Fadmin%2Frezervace",
  );
});

test("proxy redirects and clears cookie when admin session token is invalid", async () => {
  const { proxy } = await import("./proxy");
  const request = new NextRequest("https://example.com/admin/rezervace", {
    headers: {
      cookie: `${cookieName}=invalid-token-value`,
    },
  });

  const response = await proxy(request);

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://example.com/admin/prihlaseni?next=%2Fadmin%2Frezervace",
  );

  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, new RegExp(`${cookieName}=;`));
});

test("proxy allows admin route with valid signed session token", async () => {
  const { proxy } = await import("./proxy");
  const token = await createValidSessionToken();
  const request = new NextRequest("https://example.com/admin/rezervace", {
    headers: {
      cookie: `${cookieName}=${token}`,
    },
  });

  const response = await proxy(request);

  assert.equal(response.status, 200);
});

test("proxy refreshes session cookie when token is close to expiration", async () => {
  const { proxy } = await import("./proxy");
  const token = await createValidSessionToken("10m");
  const request = new NextRequest("https://example.com/admin/rezervace", {
    headers: {
      cookie: `${cookieName}=${token}`,
    },
  });

  const response = await proxy(request);

  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /ppstudio-admin-session=/);
  assert.doesNotMatch(setCookie, new RegExp(`${cookieName}=;`));
});

test("proxy rejects session after absolute max age", async () => {
  const { proxy } = await import("./proxy");
  const now = Math.floor(Date.now() / 1000);
  const oldSessionStartedAt = now - 60 * 60 * 24 * 31;
  const token = await createValidSessionToken("10m", oldSessionStartedAt);
  const request = new NextRequest("https://example.com/admin/rezervace", {
    headers: {
      cookie: `${cookieName}=${token}`,
    },
  });

  const response = await proxy(request);

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://example.com/admin/prihlaseni?next=%2Fadmin%2Frezervace",
  );
});

test("proxy allows invite route without session token", async () => {
  const { proxy } = await import("./proxy");
  const request = new NextRequest("https://example.com/admin/pozvanka/test-token");

  const response = await proxy(request);

  assert.equal(response.status, 200);
});
