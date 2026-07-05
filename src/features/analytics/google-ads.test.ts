import assert from "node:assert/strict";
import test from "node:test";

import { shouldInitializeGoogleAdsTracking } from "./google-ads";

const originalEnv = {
  enabled: process.env.NEXT_PUBLIC_GOOGLE_ADS_ENABLED,
  tagId: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
};

function setGoogleAdsConfigured() {
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ENABLED = "true";
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = "AW-18174837654";
}

function restoreEnv() {
  if (originalEnv.enabled === undefined) {
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ENABLED = originalEnv.enabled;
  }

  if (originalEnv.tagId === undefined) {
    delete process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  } else {
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ID = originalEnv.tagId;
  }
}

test("shouldInitializeGoogleAdsTracking respects disabled flag and sensitive routes", () => {
  setGoogleAdsConfigured();

  assert.equal(shouldInitializeGoogleAdsTracking("/", { disabled: false }), true);
  assert.equal(shouldInitializeGoogleAdsTracking("/", { disabled: true }), false);
  assert.equal(shouldInitializeGoogleAdsTracking("/rezervace/storno/token-123"), false);

  restoreEnv();
});
