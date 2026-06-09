import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  sanitizeMetaPixelPayload,
  shouldInitializeMetaPixelTracking,
  trackMetaPixelCustomEvent,
  trackMetaPixelStandardEvent,
} from "./meta-pixel";

const originalEnv = {
  enabled: process.env.NEXT_PUBLIC_META_PIXEL_ENABLED,
  pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
};

const originalWindow = globalThis.window;

function setMetaPixelConfigured() {
  process.env.NEXT_PUBLIC_META_PIXEL_ENABLED = "true";
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "123456789";
}

function restoreEnv() {
  if (originalEnv.enabled === undefined) {
    delete process.env.NEXT_PUBLIC_META_PIXEL_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_META_PIXEL_ENABLED = originalEnv.enabled;
  }

  if (originalEnv.pixelId === undefined) {
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
  } else {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = originalEnv.pixelId;
  }
}

afterEach(() => {
  restoreEnv();

  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
});

test("shouldInitializeMetaPixelTracking disables initialization when disabled flag is true", () => {
  setMetaPixelConfigured();

  assert.equal(shouldInitializeMetaPixelTracking("/", { disabled: false }), true);
  assert.equal(shouldInitializeMetaPixelTracking("/", { disabled: true }), false);
  assert.equal(shouldInitializeMetaPixelTracking("/rezervace/storno/token-123"), false);
});

test("sanitizeMetaPixelPayload keeps safe analytics fields and removes sensitive values", () => {
  const sanitized = sanitizeMetaPixelPayload({
    content_name: "Lash lifting",
    content_category: "Rasy",
    value: 1290,
    currency: "CZK",
    booking_weekday: "pondeli",
    client_note: "citlive",
    contact_email: "jana@example.com",
    source_context: "service_prefill",
    time_bucket: "afternoon",
  });

  assert.deepEqual(sanitized, {
    content_name: "Lash lifting",
    content_category: "Rasy",
    value: 1290,
    currency: "CZK",
    booking_weekday: "pondeli",
    source_context: "service_prefill",
    time_bucket: "afternoon",
  });
});

test("trackMetaPixelStandardEvent sends sanitized payload to fbq", () => {
  setMetaPixelConfigured();

  const calls: unknown[][] = [];
  globalThis.window = {
    fbq: (...args: unknown[]) => {
      calls.push(args);
    },
  } as Window;

  trackMetaPixelStandardEvent("Lead", {
    content_name: "Lash lifting",
    value: 1290,
    currency: "CZK",
    client_email: "jana@example.com",
  });

  assert.deepEqual(calls, [[
    "track",
    "Lead",
    {
      content_name: "Lash lifting",
      value: 1290,
      currency: "CZK",
    },
  ]]);
});

test("trackMetaPixelCustomEvent falls back to event-only call when payload sanitizes away", () => {
  setMetaPixelConfigured();

  const calls: unknown[][] = [];
  globalThis.window = {
    fbq: (...args: unknown[]) => {
      calls.push(args);
    },
  } as Window;

  trackMetaPixelCustomEvent("BookingDateSelected", {
    client_email: "jana@example.com",
  });

  assert.deepEqual(calls, [["trackCustom", "BookingDateSelected"]]);
});
