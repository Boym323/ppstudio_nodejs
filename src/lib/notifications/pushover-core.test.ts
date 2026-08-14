import assert from "node:assert/strict";
import test from "node:test";

test("sendOwnerSystemErrorPushover isolates an AdminUser database failure", async () => {
  process.env.NEXT_PUBLIC_APP_NAME = "PP Studio";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
  process.env.ADMIN_SESSION_SECRET = "test-secret-value-with-at-least-32-chars";
  process.env.ADMIN_OWNER_EMAIL = "owner@example.com";
  process.env.EMAIL_DELIVERY_MODE = "log";
  process.env.PUSHOVER_ENABLED = "true";
  process.env.PUSHOVER_APP_TOKEN = "test-pushover-token";

  const [{ prisma }, { sendOwnerSystemErrorPushover }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/notifications/pushover-core"),
  ]);
  const originalFindMany = prisma.adminUser.findMany;
  const originalConsoleError = console.error;
  const errors: unknown[][] = [];

  prisma.adminUser.findMany = (async () => {
    throw Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
  }) as typeof prisma.adminUser.findMany;
  console.error = (...args: unknown[]) => { errors.push(args); };

  try {
    await assert.doesNotReject(() => sendOwnerSystemErrorPushover({
      title: "Test fallbacku",
      message: "Owner alert nesmí rozbít původní fallback.",
      context: { contextId: "pushover-failure-isolation" },
    }));
    assert.equal(errors[0]?.[0], "Owner Pushover notification flow failed");
  } finally {
    prisma.adminUser.findMany = originalFindMany;
    console.error = originalConsoleError;
  }
});
