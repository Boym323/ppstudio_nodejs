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

test('proxy ověřuje publikaci před image cache při každém požadavku včetně legacy URL', async () => {
  const [{ proxy }, { prisma }] = await Promise.all([import('./proxy'), import('@/lib/prisma')]);
  const original = prisma.mediaAsset.findFirst;
  let published = true;
  let calls = 0;
  prisma.mediaAsset.findFirst = (async (args: unknown) => {
    calls++;
    const query = args as { where: { isPublished: boolean; visibility: string; deletionRequestedAt: null } };
    assert.equal(query.where.isPublished, true);
    assert.equal(query.where.visibility, 'PUBLIC');
    assert.equal(query.where.deletionRequestedAt, null);
    return published ? { id: 'synthetic-photo' } : null;
  }) as typeof original;
  try {
    for (const path of ['/media/public/images/2026/11/photo.jpg?media-cache=2', '/media/images/2026/11/photo.jpg']) {
      const request = new NextRequest(`https://example.com/_next/image?url=${encodeURIComponent(path)}&w=640&q=75`);
      published = true;
      assert.equal((await proxy(request)).headers.get('x-middleware-next'), '1');
      published = false;
      const denied = await proxy(request);
      assert.equal(denied.status, 404);
      assert.equal(denied.headers.get('cache-control'), 'no-store');
    }
    assert.equal(calls, 4);
    const staticImage = await proxy(new NextRequest('https://example.com/_next/image?url=%2Flogo.png&w=640&q=75'));
    assert.equal(staticImage.headers.get('x-middleware-next'), '1');
    const invalid = await proxy(new NextRequest('https://example.com/_next/image?url=%2Fmedia%2Fprivate%2F2026%2F11%2Fphoto.jpg&w=640&q=75'));
    assert.equal(invalid.status, 400);
    assert.equal(calls, 4);
  } finally {
    prisma.mediaAsset.findFirst = original;
  }
});

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
  const { SESSION_ABSOLUTE_MAX_AGE } = await import("@/lib/auth/session-token");
  const now = Math.floor(Date.now() / 1000);
  const oldSessionStartedAt = now - SESSION_ABSOLUTE_MAX_AGE - 60;
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
