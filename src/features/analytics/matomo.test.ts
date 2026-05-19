import assert from "node:assert/strict";
import test, { after } from "node:test";

import {
  shouldInitializeMatomo,
  shouldInitializeMatomoTracking,
  shouldTrackMatomoPath,
} from "./matomo";

const originalEnv = {
  enabled: process.env.NEXT_PUBLIC_MATOMO_ENABLED,
  url: process.env.NEXT_PUBLIC_MATOMO_URL,
  siteId: process.env.NEXT_PUBLIC_MATOMO_SITE_ID,
};

function setMatomoConfigured() {
  process.env.NEXT_PUBLIC_MATOMO_ENABLED = "true";
  process.env.NEXT_PUBLIC_MATOMO_URL = "https://matomo.example.com/";
  process.env.NEXT_PUBLIC_MATOMO_SITE_ID = "1";
}

function restoreEnv() {
  if (originalEnv.enabled === undefined) {
    delete process.env.NEXT_PUBLIC_MATOMO_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_MATOMO_ENABLED = originalEnv.enabled;
  }

  if (originalEnv.url === undefined) {
    delete process.env.NEXT_PUBLIC_MATOMO_URL;
  } else {
    process.env.NEXT_PUBLIC_MATOMO_URL = originalEnv.url;
  }

  if (originalEnv.siteId === undefined) {
    delete process.env.NEXT_PUBLIC_MATOMO_SITE_ID;
  } else {
    process.env.NEXT_PUBLIC_MATOMO_SITE_ID = originalEnv.siteId;
  }
}

test("shouldInitializeMatomoTracking disables initialization when disabled flag is true", () => {
  setMatomoConfigured();

  assert.equal(shouldInitializeMatomo("/"), true);
  assert.equal(shouldInitializeMatomoTracking("/", { disabled: false }), true);
  assert.equal(shouldInitializeMatomoTracking("/", { disabled: true }), false);
});

test("shouldInitializeMatomoTracking keeps existing admin route protection", () => {
  setMatomoConfigured();

  assert.equal(shouldInitializeMatomoTracking("/admin"), false);
  assert.equal(shouldInitializeMatomoTracking("/admin", { disabled: false }), false);
  assert.equal(shouldTrackMatomoPath("/admin"), false);
});

after(() => {
  restoreEnv();
});
