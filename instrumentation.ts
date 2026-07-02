import type { Instrumentation } from "next";

const SERVER_ACTION_LOOKUP_ERROR = "Failed to find Server Action";

const DEPLOYMENT_ID_ENV_KEYS = ["NEXT_DEPLOYMENT_ID", "DEPLOYMENT_VERSION", "GIT_HASH"] as const;
const OBSERVED_REQUEST_HEADERS = [
  "host",
  "origin",
  "referer",
  "content-type",
  "user-agent",
  "x-forwarded-for",
  "x-real-ip",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-deployment-id",
  "x-nextjs-data",
] as const;
const MIN_REASONABLE_SERVER_ACTION_ID_LENGTH = 16;
const SERVER_ACTION_ID_PREVIEW_LENGTH = 6;

type HeaderMap = Record<string, string | string[] | undefined>;
type NormalizedHeaderValue = string | string[] | undefined;
type NextActionHeaderSummary = {
  present: boolean;
  length?: number;
  fingerprint?: string;
  sample?: string;
  looksMalformed?: boolean;
};

function getCurrentDeploymentId() {
  for (const key of DEPLOYMENT_ID_ENV_KEYS) {
    const value = process.env[key];

    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function getServerActionsKeyFingerprint() {
  return getStableFingerprint(process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY);
}

function getStableFingerprint(value?: string) {
  if (!value) {
    return undefined;
  }

  // Non-cryptographic fingerprint is sufficient here. We only need a stable,
  // non-secret identifier that lets operations compare multiple instances.
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function getRuntimeMetadata() {
  return {
    hostname: process.env.HOSTNAME ?? undefined,
    nodeEnv: process.env.NODE_ENV ?? undefined,
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    pid: typeof process.pid === "number" ? process.pid : undefined,
    deploymentId: getCurrentDeploymentId(),
    deploymentVersion: process.env.DEPLOYMENT_VERSION ?? undefined,
    gitHash: process.env.GIT_HASH ?? undefined,
    serverActionsKeyFingerprint: getServerActionsKeyFingerprint(),
  };
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function sanitizeTokenPath(path: string) {
  const [rawPathname] = path.split("?");

  if (rawPathname.startsWith("/rezervace/sprava/")) {
    return "/rezervace/sprava/[redacted]";
  }

  if (rawPathname.startsWith("/rezervace/storno/")) {
    return "/rezervace/storno/[redacted]";
  }

  if (rawPathname.startsWith("/rezervace/akce/")) {
    const parts = rawPathname.split("/").filter(Boolean);
    const intent = parts[2] ?? "[intent]";

    return `/rezervace/akce/${intent}/[redacted]`;
  }

  if (rawPathname.startsWith("/api/bookings/calendar/")) {
    return "/api/bookings/calendar/[redacted].ics";
  }

  return rawPathname;
}

function sanitizeUrlLikeValue(value: string) {
  try {
    const parsed = new URL(value);

    return `${parsed.origin}${sanitizeTokenPath(parsed.pathname)}`;
  } catch {
    return sanitizeTokenPath(value);
  }
}

function normalizeSingleHeaderValue(value: string, headerName: string): Exclude<NormalizedHeaderValue, undefined> {
  const normalizedHeaderName = headerName.toLowerCase();

  if (normalizedHeaderName === "referer" || normalizedHeaderName === "origin") {
    return sanitizeUrlLikeValue(value);
  }

  if (normalizedHeaderName === "user-agent") {
    return truncate(value, 256);
  }

  if (normalizedHeaderName === "x-forwarded-for") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 2);
  }

  return truncate(value, 256);
}

function normalizeHeaderValue(
  value: string | string[] | undefined,
  headerName: string,
): NormalizedHeaderValue {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    const normalizedValues = value.flatMap((entry) => {
      const normalizedEntry = normalizeSingleHeaderValue(entry, headerName);

      return Array.isArray(normalizedEntry) ? normalizedEntry : [normalizedEntry];
    });

    if (normalizedValues.length === 0) {
      return undefined;
    }

    return normalizedValues.length === 1 ? normalizedValues[0] : normalizedValues;
  }

  return normalizeSingleHeaderValue(value, headerName);
}

function getHeader(headers: HeaderMap, name: string) {
  return headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
}

function pickObservedHeaders(headers: HeaderMap) {
  const selectedHeaders: Record<string, string | string[] | undefined> = {};

  for (const headerName of OBSERVED_REQUEST_HEADERS) {
    const value = getHeader(headers, headerName);
    const normalizedValue = normalizeHeaderValue(value, headerName);

    if (normalizedValue !== undefined) {
      selectedHeaders[headerName] = normalizedValue;
    }
  }

  return selectedHeaders;
}

function summarizeNextActionHeader(headers: HeaderMap): NextActionHeaderSummary {
  const nextActionHeader = getHeader(headers, "next-action");

  if (typeof nextActionHeader !== "string") {
    return { present: false };
  }

  const normalizedActionId = nextActionHeader.trim();

  if (normalizedActionId.length === 0) {
    return {
      present: true,
      length: 0,
      looksMalformed: true,
    };
  }

  const isShortMalformed = normalizedActionId.length < MIN_REASONABLE_SERVER_ACTION_ID_LENGTH;

  return {
    present: true,
    length: normalizedActionId.length,
    fingerprint: getStableFingerprint(normalizedActionId),
    sample:
      normalizedActionId.length <= MIN_REASONABLE_SERVER_ACTION_ID_LENGTH
        ? normalizedActionId
        : `${normalizedActionId.slice(0, SERVER_ACTION_ID_PREVIEW_LENGTH)}...${normalizedActionId.slice(
            -SERVER_ACTION_ID_PREVIEW_LENGTH,
          )}`,
    looksMalformed: isShortMalformed,
  };
}

function inferServerActionErrorCause({
  isServerActionLookupError,
  clientDeploymentId,
  currentDeploymentId,
  serverActionsKeyFingerprint,
  nextActionHeaderSummary,
}: {
  isServerActionLookupError: boolean;
  clientDeploymentId?: string;
  currentDeploymentId?: string;
  serverActionsKeyFingerprint?: string;
  nextActionHeaderSummary: NextActionHeaderSummary;
}) {
  if (!isServerActionLookupError) {
    return undefined;
  }

  if (nextActionHeaderSummary.looksMalformed) {
    return "malformed-next-action-header";
  }

  if (clientDeploymentId && currentDeploymentId && clientDeploymentId !== currentDeploymentId) {
    return "deployment-id-mismatch";
  }

  if (!serverActionsKeyFingerprint) {
    return "missing-server-actions-encryption-key";
  }

  return "stale-client-or-server-actions-key-mismatch";
}

function getServerActionHint(cause?: string) {
  switch (cause) {
    case "malformed-next-action-header":
      return "Request poslal podezřelý nebo zjevně nevalidní next-action header. Často jde o scan/probing, ne o skutečný stale klientský tab.";
    case "deployment-id-mismatch":
      return "Klient poslal jiný x-deployment-id než běžící server. Ověř rolling deploy, sticky sessions a že všechny instance stejného release sdílí stejný build.";
    case "missing-server-actions-encryption-key":
      return "Na serveru chybí NEXT_SERVER_ACTIONS_ENCRYPTION_KEY. V multi-instance nebo rolling deploy režimu to může rozbíjet Server Actions.";
    case "stale-client-or-server-actions-key-mismatch":
      return "DeploymentId sedí nebo chybí, ale action ID server nezná. Ověř stejný NEXT_SERVER_ACTIONS_ENCRYPTION_KEY na všech instancích a vynucený hard reload po deployi.";
    default:
      return undefined;
  }
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    const errorWithDigest = error as Error & { digest?: string };

    return {
      name: error.name,
      message: error.message,
      digest: errorWithDigest.digest,
      stack: error.stack ? truncate(error.stack, 4000) : undefined,
    };
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "Unknown request error",
    digest: undefined,
    stack: undefined,
  };
}

export async function register() {
  console.info(
    "[ppstudio.next.register]",
    JSON.stringify({
      event: "next-server-register",
      timestamp: new Date().toISOString(),
      ...getRuntimeMetadata(),
    }),
  );
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const runtime = getRuntimeMetadata();
  const observedHeaders = pickObservedHeaders(request.headers);
  const clientDeploymentId = getHeader(request.headers, "x-deployment-id");
  const nextActionHeaderSummary = summarizeNextActionHeader(request.headers);
  const errorDetails = getErrorDetails(error);
  const isServerActionLookupError = errorDetails.message.includes(SERVER_ACTION_LOOKUP_ERROR);
  const suspectedCause = inferServerActionErrorCause({
    isServerActionLookupError,
    clientDeploymentId: typeof clientDeploymentId === "string" ? clientDeploymentId : undefined,
    currentDeploymentId: runtime.deploymentId,
    serverActionsKeyFingerprint: runtime.serverActionsKeyFingerprint,
    nextActionHeaderSummary,
  });

  console.error(
    "[ppstudio.next.request-error]",
    JSON.stringify({
      event: "next-request-error",
      timestamp: new Date().toISOString(),
      isServerActionLookupError,
      suspectedCause,
      hint: getServerActionHint(suspectedCause),
      runtime,
      request: {
        method: request.method,
        path: sanitizeTokenPath(request.path),
        headers: observedHeaders,
        nextAction: nextActionHeaderSummary.present ? nextActionHeaderSummary : undefined,
      },
      context,
      error: errorDetails,
    }),
  );
};
