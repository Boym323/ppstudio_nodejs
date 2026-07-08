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

test("GET returns fallback analytics including contactStepQuality when reporting is blocked", async () => {
  const { createAdminAnalyticsRouteApi } = await import("./route");

  const api = createAdminAnalyticsRouteApi({
    getSession: async () => ({
      sub: "admin-1",
      role: AdminRole.OWNER,
      email: "owner@example.com",
      name: "Owner",
      iat: 1,
      exp: 999999,
    }),
    getMatomoReportingHealth: async () => ({
      status: "blocked",
      message: "Matomo lockout",
    }),
    getDashboardAnalytics: async () => {
      throw new Error("getDashboardAnalytics should not run when reporting is blocked");
    },
    notifySystemError: async () => {
      throw new Error("notifySystemError should not run when reporting is blocked");
    },
  });

  const response = await api.GET();
  const payload = (await response.json()) as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(payload.reportingStatus, "blocked");
  assert.deepEqual(payload.funnel, {
    viewed: 0,
    service: 0,
    term: 0,
    contact: 0,
    submitted: 0,
    created: 0,
  });
  assert.deepEqual(payload.contactStepQuality, {
    started: 0,
    fieldFocus: 0,
    fieldInputStarted: 0,
    fieldError: 0,
    focusRate: 0,
    inputRate: 0,
    errorRate: 0,
  });
});

test("GET notifies owner when analytics backend throws unexpected error", async () => {
  const { createAdminAnalyticsRouteApi } = await import("./route");
  const notifications: Array<Record<string, unknown>> = [];

  const api = createAdminAnalyticsRouteApi({
    getSession: async () => ({
      sub: "admin-2",
      role: AdminRole.SALON,
      email: "salon@example.com",
      name: "Salon",
      iat: 1,
      exp: 999999,
    }),
    getMatomoReportingHealth: async () => ({
      status: "ok",
      message: undefined,
    }),
    getDashboardAnalytics: async () => {
      throw new Error("Matomo timeout");
    },
    notifySystemError: async (input) => {
      notifications.push(input as unknown as Record<string, unknown>);
    },
  });

  const response = await api.GET();
  const payload = (await response.json()) as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.equal(payload.reportingStatus, "error");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.title, "PP Studio - systemova chyba");
  assert.equal(notifications[0]?.message, "Admin analytics API vratilo fallback kvuli neocekavane chybe.");
  assert.deepEqual(notifications[0]?.context, {
    contextId: "admin-analytics-api",
    adminUserId: "admin-2",
    role: AdminRole.SALON,
  });
});
