import assert from "node:assert/strict";
import test from "node:test";
import { AdminRole } from "@prisma/client";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

type LoginOutcome = "SUCCESS" | "INVALID_PAYLOAD" | "INVALID_CREDENTIALS" | "RATE_LIMITED";

function buildLoginRequest(email: string, password: string) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);

  return new Request("https://example.com/api/auth/login", {
    method: "POST",
    headers: {
      "x-forwarded-for": "198.51.100.20",
      "user-agent": "unit-test-agent",
    },
    body: formData,
  });
}

test("POST returns rate_limited redirect when attempt limit is exceeded", async () => {
  const { createAdminLoginRouteApi } = await import("./route");
  const loggedOutcomes: LoginOutcome[] = [];

  const api = createAdminLoginRouteApi({
    normalizeAdminLoginEmail: () => "owner@example.com",
    getAdminLoginAttemptMetadata: () => ({
      ipHash: "ip-hash",
      emailHash: "email-hash",
      userAgent: "unit-test-agent",
    }),
    getRecentAdminLoginAttemptCounts: async () => ({ ipAttempts: 20, emailFailures: 0 }),
    isAdminLoginRateLimited: () => true,
    writeAdminLoginAttemptLog: async ({ loginOutcome }) => {
      loggedOutcomes.push(loginOutcome);
    },
    authenticateAdmin: async () => {
      throw new Error("authenticateAdmin should not run when rate limited");
    },
    createSessionToken: async () => "token",
    getSessionCookie: () => ({
      name: "ppstudio-admin-session",
      options: { httpOnly: true, sameSite: "lax" as const, secure: false, path: "/", maxAge: 3600 },
    }),
    buildAbsoluteUrl: (_request, path) => new URL(path, "https://example.com"),
  });

  const response = await api.POST(buildLoginRequest("owner@example.com", "super-safe-password"));

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://example.com/admin/prihlaseni?error=rate_limited");
  assert.deepEqual(loggedOutcomes, ["RATE_LIMITED"]);
});

test("POST returns invalid_payload redirect for malformed form data", async () => {
  const { createAdminLoginRouteApi } = await import("./route");
  const loggedOutcomes: LoginOutcome[] = [];

  const api = createAdminLoginRouteApi({
    normalizeAdminLoginEmail: () => "owner@example.com",
    getAdminLoginAttemptMetadata: () => ({
      ipHash: "ip-hash",
      emailHash: "email-hash",
      userAgent: "unit-test-agent",
    }),
    getRecentAdminLoginAttemptCounts: async () => ({ ipAttempts: 0, emailFailures: 0 }),
    isAdminLoginRateLimited: () => false,
    writeAdminLoginAttemptLog: async ({ loginOutcome }) => {
      loggedOutcomes.push(loginOutcome);
    },
    authenticateAdmin: async () => {
      throw new Error("authenticateAdmin should not run for invalid payload");
    },
    createSessionToken: async () => "token",
    getSessionCookie: () => ({
      name: "ppstudio-admin-session",
      options: { httpOnly: true, sameSite: "lax" as const, secure: false, path: "/", maxAge: 3600 },
    }),
    buildAbsoluteUrl: (_request, path) => new URL(path, "https://example.com"),
  });

  const response = await api.POST(buildLoginRequest("invalid-email", "short"));

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://example.com/admin/prihlaseni?error=invalid_payload");
  assert.deepEqual(loggedOutcomes, ["INVALID_PAYLOAD"]);
});

test("POST returns invalid_credentials redirect for wrong credentials", async () => {
  const { createAdminLoginRouteApi } = await import("./route");
  const loggedOutcomes: LoginOutcome[] = [];

  const api = createAdminLoginRouteApi({
    normalizeAdminLoginEmail: () => "owner@example.com",
    getAdminLoginAttemptMetadata: () => ({
      ipHash: "ip-hash",
      emailHash: "email-hash",
      userAgent: "unit-test-agent",
    }),
    getRecentAdminLoginAttemptCounts: async () => ({ ipAttempts: 0, emailFailures: 0 }),
    isAdminLoginRateLimited: () => false,
    writeAdminLoginAttemptLog: async ({ loginOutcome }) => {
      loggedOutcomes.push(loginOutcome);
    },
    authenticateAdmin: async () => null,
    createSessionToken: async () => {
      throw new Error("createSessionToken should not run for invalid credentials");
    },
    getSessionCookie: () => ({
      name: "ppstudio-admin-session",
      options: { httpOnly: true, sameSite: "lax" as const, secure: false, path: "/", maxAge: 3600 },
    }),
    buildAbsoluteUrl: (_request, path) => new URL(path, "https://example.com"),
  });

  const response = await api.POST(buildLoginRequest("owner@example.com", "wrong-password-value"));

  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "https://example.com/admin/prihlaseni?error=invalid_credentials",
  );
  assert.deepEqual(loggedOutcomes, ["INVALID_CREDENTIALS"]);
});

test("POST sets session cookie and redirects to admin home after successful login", async () => {
  const { createAdminLoginRouteApi } = await import("./route");
  const loggedOutcomes: LoginOutcome[] = [];

  const api = createAdminLoginRouteApi({
    normalizeAdminLoginEmail: () => "owner@example.com",
    getAdminLoginAttemptMetadata: () => ({
      ipHash: "ip-hash",
      emailHash: "email-hash",
      userAgent: "unit-test-agent",
    }),
    getRecentAdminLoginAttemptCounts: async () => ({ ipAttempts: 0, emailFailures: 0 }),
    isAdminLoginRateLimited: () => false,
    writeAdminLoginAttemptLog: async ({ loginOutcome }) => {
      loggedOutcomes.push(loginOutcome);
    },
    authenticateAdmin: async () => ({
      id: "admin-1",
      email: "owner@example.com",
      name: "Owner",
      role: AdminRole.OWNER,
    }),
    createSessionToken: async () => "signed-session-token",
    getSessionCookie: () => ({
      name: "ppstudio-admin-session",
      options: { httpOnly: true, sameSite: "lax" as const, secure: false, path: "/", maxAge: 43200 },
    }),
    buildAbsoluteUrl: (_request, path) => new URL(path, "https://example.com"),
  });

  const response = await api.POST(buildLoginRequest("owner@example.com", "super-safe-password"));

  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://example.com/admin");

  const cookieHeader = response.headers.get("set-cookie") ?? "";
  assert.match(cookieHeader, /ppstudio-admin-session=signed-session-token/);
  assert.match(cookieHeader, /HttpOnly/i);

  assert.deepEqual(loggedOutcomes, ["SUCCESS"]);
});
