import type { MetaCapiConfig } from "./meta-capi-config";

export type MetaScheduleEvent = {
  id: string;
  eventId: string;
  eventTime: Date;
  eventSourceUrl: string;
  userAgent: string | null;
  fbp: string | null;
  fbc: string | null;
};

export type MetaCapiEventPayload = {
  event_name: "Schedule";
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: "website";
  user_data: {
    client_user_agent: string;
    fbp?: string;
    fbc?: string;
  };
};

export class MetaCapiRequestError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "MetaCapiRequestError";
  }
}

export function buildMetaCapiEventPayload(event: MetaScheduleEvent): MetaCapiEventPayload {
  if (!event.userAgent) {
    throw new MetaCapiRequestError("MISSING_USER_AGENT", false);
  }

  return {
    event_name: "Schedule",
    event_time: Math.floor(event.eventTime.getTime() / 1_000),
    event_id: event.eventId,
    event_source_url: event.eventSourceUrl,
    action_source: "website",
    user_data: {
      client_user_agent: event.userAgent,
      ...(event.fbp ? { fbp: event.fbp } : {}),
      ...(event.fbc ? { fbc: event.fbc } : {}),
    },
  };
}

type MetaCapiResponse = {
  events_received?: unknown;
  error?: {
    code?: unknown;
    is_transient?: unknown;
  };
};

function parseResponse(value: unknown): MetaCapiResponse | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as MetaCapiResponse
    : null;
}

function formatMetaErrorCode(code: unknown, status: number) {
  return typeof code === "number" && Number.isInteger(code)
    ? `META_${code}`
    : `HTTP_${status}`;
}

export async function sendMetaCapiEvent(
  event: MetaScheduleEvent,
  config: MetaCapiConfig | null,
) {
  if (!config) {
    throw new MetaCapiRequestError("CAPI_NOT_CONFIGURED", false);
  }

  const endpoint = `https://graph.facebook.com/${config.apiVersion}/${config.datasetId}/events`;
  const body = new URLSearchParams({
    access_token: config.accessToken,
    data: JSON.stringify([buildMetaCapiEventPayload(event)]),
  });

  if (config.testEventCode) {
    body.set("test_event_code", config.testEventCode);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  let result: MetaCapiResponse | null = null;
  try {
    result = parseResponse(await response.json());
  } catch {
    // Odpověď se záměrně neloguje; může obsahovat interní Meta diagnostiku.
  }

  if (!response.ok || result?.error) {
    const code = formatMetaErrorCode(result?.error?.code, response.status);
    const retryable =
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500 ||
      result?.error?.is_transient === true;

    throw new MetaCapiRequestError(code, retryable);
  }

  if (result?.events_received !== 1) {
    throw new MetaCapiRequestError("UNEXPECTED_RESPONSE", true);
  }
}
