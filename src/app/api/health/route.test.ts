import assert from "node:assert/strict";
import test from "node:test";
import type { EmailHealthData } from "./route-api";

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

function createEmailHealthData(
  overrides: Partial<EmailHealthData> = {},
): EmailHealthData {
  return {
    pending: 0,
    retrying: 0,
    processingActive: 0,
    processingStale: 0,
    failed: 0,
    lastSentAt: null,
    latestError: null,
    ...overrides,
  };
}

test("GET odděluje recipient delivery incidenty od kritického stavu workeru", async () => {
  const { createHealthRouteApi } = await import("./route-api");
  const cases = [
    {
      name: "bez incidentů",
      data: createEmailHealthData(),
      httpStatus: 200,
      status: "ok",
      workerStatus: "ok",
      activeIncidents: 0,
    },
    {
      name: "s nevyřešeným bouncem",
      data: createEmailHealthData({ failed: 1 }),
      httpStatus: 200,
      status: "warning",
      workerStatus: "ok",
      activeIncidents: 1,
    },
    {
      name: "s nevyřešenou suppression",
      data: createEmailHealthData({ failed: 1 }),
      httpStatus: 200,
      status: "warning",
      workerStatus: "ok",
      activeIncidents: 1,
    },
    {
      name: "s vyřešeným bouncem",
      data: createEmailHealthData(),
      httpStatus: 200,
      status: "ok",
      workerStatus: "ok",
      activeIncidents: 0,
    },
    {
      name: "pouze se spam complaintem",
      // Complaint je reputační incident pro administraci; není součástí
      // delivery-failure agregace, která napájí health endpoint.
      data: createEmailHealthData(),
      httpStatus: 200,
      status: "ok",
      workerStatus: "ok",
      activeIncidents: 0,
    },
    {
      name: "se stale worker claimem",
      data: createEmailHealthData({ processingStale: 1 }),
      httpStatus: 503,
      status: "error",
      workerStatus: "error",
      activeIncidents: 0,
    },
    {
      name: "s bouncem a stale worker claimem",
      data: createEmailHealthData({ failed: 1, processingStale: 1 }),
      httpStatus: 503,
      status: "error",
      workerStatus: "error",
      activeIncidents: 1,
    },
  ];

  for (const scenario of cases) {
    const api = createHealthRouteApi({
      checkDatabase: async () => undefined,
      getEmailHealthData: async () => scenario.data,
    });
    const response = await api.GET();
    const payload = await response.json();

    assert.equal(response.status, scenario.httpStatus, scenario.name);
    assert.equal(payload.status, scenario.status, scenario.name);
    assert.equal(payload.emailWorker.status, scenario.workerStatus, scenario.name);
    assert.equal(
      payload.emailIncidents.active,
      scenario.activeIncidents,
      scenario.name,
    );
  }
});

test("GET při výpadku DB vrátí stabilní kód bez diagnostiky a alert potlačí cooldownem", async () => {
  const { createDbFailureAlertCooldown, createHealthRouteApi } =
    await import("./route-api");
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

test("GET při selhání detailních emailových DB dotazů degraduje na warning místo 500", async () => {
  const { createHealthRouteApi } = await import("./route-api");
  const healthDataError = new Error('column "processingToken" does not exist');
  const loggedErrors: unknown[] = [];
  const api = createHealthRouteApi({
    checkDatabase: async () => undefined,
    getEmailHealthData: async () => {
      throw healthDataError;
    },
    logEmailHealthError: (error) => {
      loggedErrors.push(error);
    },
  });

  const response = await api.GET();
  const payload = await response.json();
  const serializedPayload = JSON.stringify(payload);

  assert.equal(response.status, 200);
  assert.match(serializedPayload, /EMAIL_HEALTH_UNAVAILABLE/);
  assert.match(serializedPayload, /"status":"warning"/);
  assert.doesNotMatch(serializedPayload, /processingToken/);
  assert.equal(loggedErrors.length, 1);
  assert.equal(loggedErrors[0], healthDataError);
});
