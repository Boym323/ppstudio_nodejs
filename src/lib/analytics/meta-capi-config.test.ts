import assert from "node:assert/strict";
import test from "node:test";

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET = "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL = "owner@example.com";

import type { MetaCapiEnvironment } from "./meta-capi-config";

const enabledTestConfig: MetaCapiEnvironment = {
  NODE_ENV: "test",
  META_CAPI_ENABLED: "true",
  META_CAPI_DATASET_ID: "123456789012345",
  META_CAPI_ACCESS_TOKEN: "server-only-test-token",
  META_CAPI_API_VERSION: "v26.0",
  META_CAPI_TEST_EVENT_CODE: "TEST12345",
  NEXT_PUBLIC_META_PIXEL_ENABLED: "true",
  NEXT_PUBLIC_META_PIXEL_ID: "123456789012345",
};

test("nonproduction CAPI requires a separate test dataset and matching Pixel", async () => {
  const { resolveMetaCapiConfig } = await import("./meta-capi-config");

  assert.deepEqual(resolveMetaCapiConfig(enabledTestConfig), {
    datasetId: "123456789012345",
    accessToken: "server-only-test-token",
    apiVersion: "v26.0",
    testEventCode: "TEST12345",
  });

  assert.equal(resolveMetaCapiConfig({
    ...enabledTestConfig,
    META_CAPI_DATASET_ID: "1002460135763604",
    NEXT_PUBLIC_META_PIXEL_ID: "1002460135763604",
  }), null);
  assert.equal(resolveMetaCapiConfig({
    ...enabledTestConfig,
    META_CAPI_TEST_EVENT_CODE: undefined,
  }), null);
  assert.equal(resolveMetaCapiConfig({
    ...enabledTestConfig,
    NEXT_PUBLIC_META_PIXEL_ID: undefined,
  }), null);
  assert.equal(resolveMetaCapiConfig({
    ...enabledTestConfig,
    NEXT_PUBLIC_META_PIXEL_ID: "987654321012345",
  }), null);
});

test("production CAPI requires the same Pixel ID and rejects a Test Events code", async () => {
  const { resolveMetaCapiConfig } = await import("./meta-capi-config");

  assert.deepEqual(resolveMetaCapiConfig({
    ...enabledTestConfig,
    NODE_ENV: "production",
    META_CAPI_TEST_EVENT_CODE: undefined,
  }), {
    datasetId: "123456789012345",
    accessToken: "server-only-test-token",
    apiVersion: "v26.0",
    testEventCode: undefined,
  });

  assert.equal(resolveMetaCapiConfig({
    ...enabledTestConfig,
    NODE_ENV: "production",
  }), null);
});
