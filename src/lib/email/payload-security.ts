import { Prisma } from "@/generated/prisma/client";

export const REDACTED_EMAIL_PAYLOAD_VALUE = "[REDACTED]";

export const SENSITIVE_EMAIL_PAYLOAD_FIELDS = [
  "manageReservationUrl",
  "cancellationUrl",
  "approveUrl",
  "rejectUrl",
] as const;

function isJsonObject(value: unknown): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasSensitiveEmailPayloadField(payload: Prisma.JsonValue | null | undefined) {
  return isJsonObject(payload)
    && SENSITIVE_EMAIL_PAYLOAD_FIELDS.some((field) => Object.prototype.hasOwnProperty.call(payload, field));
}

/** Zachová celý payload a rediguje pouze známá bearer URL pole na jeho nejvyšší úrovni. */
export function scrubSensitiveEmailPayload(payload: Prisma.JsonValue | null | undefined) {
  if (!isJsonObject(payload)) {
    return payload === null || payload === undefined
      ? undefined
      : (payload as Prisma.InputJsonValue);
  }

  const scrubbedPayload = { ...payload } as Record<string, unknown>;
  let changed = false;

  for (const field of SENSITIVE_EMAIL_PAYLOAD_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(scrubbedPayload, field)) {
      scrubbedPayload[field] = REDACTED_EMAIL_PAYLOAD_VALUE;
      changed = true;
    }
  }

  return changed
    ? (scrubbedPayload as Prisma.InputJsonObject)
    : (payload as Prisma.InputJsonObject);
}
