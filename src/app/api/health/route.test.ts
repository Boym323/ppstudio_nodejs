import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

test("GET při výpadku DB vrátí stabilní kód bez diagnostiky a alert potlačí cooldownem", async () => {
  const { createDbFailureAlertCooldown, createHealthRouteApi } =
    await import("./route");
  const notifications: Array<Record<string, unknown>> = [];
  const now = new Date("2026-07-10T10:00:00.000Z");
  const api = createHealthRouteApi({
    checkDatabase: async () => {
      throw new Error("connect ECONNREFUSED postgres.internal:5432/ppstudio");
    },
    notifySystemError: async (input) => {
      notifications.push(input as unknown as Record<string, unknown>);
    },
    now: () => now,
    claimDbFailureAlert: createDbFailureAlertCooldown(),
  });

  const responses = await Promise.all(
    Array.from({ length: 10 }, () => api.GET()),
  );
  const payloads = await Promise.all(
    responses.map((response) => response.json()),
  );

  assert.equal(notifications.length, 1);

  for (const [index, response] of responses.entries()) {
    const serializedPayload = JSON.stringify(payloads[index]);

    assert.equal(response.status, 503);
    assert.match(serializedPayload, /DATABASE_UNAVAILABLE/);
    assert.doesNotMatch(
      serializedPayload,
      /ECONNREFUSED|postgres\.internal|ppstudio/,
    );
  }
});
