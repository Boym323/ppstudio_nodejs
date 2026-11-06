import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  buildMetaCapiEventPayload,
  MetaCapiRequestError,
  sendMetaCapiEvent,
  type MetaScheduleEvent,
} from "./meta-capi";

const originalFetch = globalThis.fetch;

const config = {
  datasetId: "123456789012345",
  accessToken: "server-only-test-token",
  apiVersion: "v26.0",
  testEventCode: "TEST12345",
};

const event: MetaScheduleEvent = {
  id: "outbox-row-internal-id",
  eventId: "b0b797be-516d-4d10-bf70-9491e50c14e9",
  eventTime: new Date("2026-11-01T10:15:32.000Z"),
  eventSourceUrl: "https://ppstudio.example/rezervace",
  userAgent: "Mozilla/5.0 test browser",
  fbp: "fb.1.1793528132000.1234567890",
  fbc: "fb.1.1793528132000.AbCdEf12345",
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("CAPI Schedule payload uses the booking time and stable event id without contact data", () => {
  assert.deepEqual(buildMetaCapiEventPayload(event), {
    event_name: "Schedule",
    event_time: Math.floor(event.eventTime.getTime() / 1_000),
    event_id: event.eventId,
    event_source_url: "https://ppstudio.example/rezervace",
    action_source: "website",
    user_data: {
      client_user_agent: event.userAgent,
      fbp: event.fbp,
      fbc: event.fbc,
    },
  });
});

test("CAPI sends its access token in the request body, not the endpoint URL", async () => {
  let requestUrl = "";
  let requestBody: URLSearchParams | undefined;

  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = new URLSearchParams(String(init?.body));
    return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
  };

  await sendMetaCapiEvent(event, config);

  assert.equal(requestUrl, "https://graph.facebook.com/v26.0/123456789012345/events");
  assert.equal(new URL(requestUrl).searchParams.has("access_token"), false);
  assert.equal(requestBody?.get("access_token"), config.accessToken);
  assert.equal(requestBody?.get("test_event_code"), config.testEventCode);
  assert.equal(JSON.parse(requestBody?.get("data") ?? "[]")[0].event_id, event.eventId);
});

test("CAPI failures expose only a safe code and mark transient server errors retryable", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 190, message: "server-only-test-token must not be logged" },
  }), { status: 500 });

  await assert.rejects(
    sendMetaCapiEvent(event, config),
    (error: unknown) => {
      assert.ok(error instanceof MetaCapiRequestError);
      assert.equal(error.code, "META_190");
      assert.equal(error.retryable, true);
      assert.equal(error.message.includes(config.accessToken), false);
      return true;
    },
  );
});

test("CAPI does not send an event without the required website user agent", () => {
  assert.throws(
    () => buildMetaCapiEventPayload({ ...event, userAgent: null }),
    (error: unknown) => error instanceof MetaCapiRequestError && error.code === "MISSING_USER_AGENT",
  );
});
