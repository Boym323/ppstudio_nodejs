import { env } from "@/config/env";

export type MetaCapiConfig = {
  datasetId: string;
  accessToken: string;
  apiVersion: string;
  testEventCode?: string;
};

export type MetaCapiEnvironment = Pick<
  typeof env,
  | "NODE_ENV"
  | "META_CAPI_ENABLED"
  | "META_CAPI_DATASET_ID"
  | "META_CAPI_ACCESS_TOKEN"
  | "META_CAPI_API_VERSION"
  | "META_CAPI_TEST_EVENT_CODE"
  | "NEXT_PUBLIC_META_PIXEL_ENABLED"
  | "NEXT_PUBLIC_META_PIXEL_ID"
>;

export function resolveMetaCapiConfig(configuration: MetaCapiEnvironment): MetaCapiConfig | null {
  if (
    configuration.META_CAPI_ENABLED !== "true" ||
    configuration.NEXT_PUBLIC_META_PIXEL_ENABLED !== "true" ||
    !configuration.NEXT_PUBLIC_META_PIXEL_ID ||
    !configuration.META_CAPI_DATASET_ID ||
    configuration.NEXT_PUBLIC_META_PIXEL_ID !== configuration.META_CAPI_DATASET_ID ||
    !configuration.META_CAPI_ACCESS_TOKEN
  ) {
    return null;
  }

  // Nonproduction traffic must always be explicitly routed to Test Events.
  if (configuration.NODE_ENV !== "production" && !configuration.META_CAPI_TEST_EVENT_CODE) {
    return null;
  }

  if (
    configuration.NODE_ENV !== "production" &&
    configuration.META_CAPI_DATASET_ID === "1002460135763604"
  ) {
    return null;
  }

  if (configuration.NODE_ENV === "production" && configuration.META_CAPI_TEST_EVENT_CODE) {
    return null;
  }

  return {
    datasetId: configuration.META_CAPI_DATASET_ID,
    accessToken: configuration.META_CAPI_ACCESS_TOKEN,
    apiVersion: configuration.META_CAPI_API_VERSION,
    testEventCode: configuration.META_CAPI_TEST_EVENT_CODE,
  };
}

export function getMetaCapiConfig() {
  return resolveMetaCapiConfig(env);
}
