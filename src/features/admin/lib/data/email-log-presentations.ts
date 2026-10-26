import {
  BookingActionTokenType,
  AvailabilitySlotStatus,
  BookingStatus,
  EmailIncidentManualResolutionReason,
  EmailLogStatus,
  EmailLogType,
  Prisma,
} from "@/generated/prisma/client";

import { deriveTrackingState } from "@/lib/email/resend-webhooks";

export const formatTime = new Intl.DateTimeFormat("cs-CZ", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

const formatDateTime = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

export function formatDateTimeLabel(value: Date | null | undefined): string {
  if (!value) {
    return "Bez času";
  }

  return formatDateTime.format(value);
}

export function manualIncidentResolutionReasonLabel(reason: EmailIncidentManualResolutionReason | null) {
  switch (reason) {
    case EmailIncidentManualResolutionReason.HISTORICAL:
      return "Historický";
    case EmailIncidentManualResolutionReason.CONTACTED_OTHER_WAY:
      return "Kontaktována jinak";
    case EmailIncidentManualResolutionReason.NO_LONGER_RELEVANT:
      return "Již nerelevantní";
    case EmailIncidentManualResolutionReason.OTHER:
      return "Jiný důvod";
    default:
      return "Bez uvedeného důvodu";
  }
}

export function formatTimeRange(startsAt: Date, endsAt: Date): string {
  return `${formatDateTimeLabel(startsAt)} - ${formatTime.format(endsAt)}`;
}

export function statusLabel(status: BookingStatus | AvailabilitySlotStatus | EmailLogStatus): string {
  switch (status) {
    case BookingStatus.PENDING:
      return "Čeká";
    case BookingStatus.CONFIRMED:
      return "Potvrzeno";
    case BookingStatus.CANCELLED:
      return "Zrušeno";
    case BookingStatus.COMPLETED:
      return "Hotovo";
    case BookingStatus.NO_SHOW:
      return "Nedorazila";
    case AvailabilitySlotStatus.DRAFT:
      return "Draft";
    case AvailabilitySlotStatus.PUBLISHED:
      return "Publikováno";
    case AvailabilitySlotStatus.CANCELLED:
      return "Zrušeno";
    case AvailabilitySlotStatus.ARCHIVED:
      return "Archiv";
    case EmailLogStatus.PENDING:
      return "Čeká";
    case EmailLogStatus.SENT:
      return "Odesláno";
    case EmailLogStatus.FAILED:
      return "Chyba";
    default:
      return String(status);
  }
}

export function retryStateLabel(
  nextAttemptAt: Date | null,
  processingStartedAt: Date | null,
  attemptCount: number,
): string {
  if (processingStartedAt) {
    return `Zpracovává se • pokus ${attemptCount}`;
  }

  if (attemptCount > 0) {
    return `Retry • další pokus ${formatDateTimeLabel(nextAttemptAt)}`;
  }

  return `Ve frontě • další pokus ${formatDateTimeLabel(nextAttemptAt)}`;
}

type EmailTrackingInput = Parameters<typeof deriveTrackingState>[0];

export function getEmailDetailFinalStatus(input: {
  status: EmailLogStatus;
  sentAt: Date | null;
  processingStartedAt: Date | null;
  attemptCount: number;
  nextAttemptAt: Date | null;
  updatedAt: Date;
} & EmailTrackingInput): {
  value: "sent" | "pending" | "retry" | "failed";
  label: string;
  detail: string;
  needsAttention: boolean;
} {
  const tracking = deriveTrackingState(input);

  if (tracking.value === "failed") {
    return {
      value: "failed" as const,
      label: "Nedoručeno",
      detail: input.trackingBouncedAt
        ? "Odmítnuto cílovým serverem (bounce)"
        : tracking.label,
      needsAttention: true,
    };
  }

  if (tracking.value === "retry") {
    const isComplaint = input.trackingComplainedAt !== null;

    return {
      value: "retry" as const,
      label: isComplaint ? "Nahlášeno jako spam" : "Doručení vyžaduje pozornost",
      detail: tracking.label,
      needsAttention: true,
    };
  }

  if (input.sentAt) {
    return {
      value: "sent" as const,
      label: "Odesláno",
      detail: `Odeslání providerovi úspěšné ${formatDateTimeLabel(input.sentAt)}`,
      needsAttention: false,
    };
  }

  if (input.attemptCount > 0 && input.status !== EmailLogStatus.FAILED) {
    return {
      value: "retry" as const,
      label: "Retry",
      detail: input.processingStartedAt
        ? `Probíhá další pokus od ${formatDateTimeLabel(input.processingStartedAt)}`
        : `Další pokus ${formatDateTimeLabel(input.nextAttemptAt)}`,
      needsAttention: true,
    };
  }

  if (input.status === EmailLogStatus.FAILED) {
    return {
      value: "failed" as const,
      label: "Selhalo",
      detail: `Poslední pokus ${formatDateTimeLabel(input.processingStartedAt ?? input.updatedAt)}`,
      needsAttention: true,
    };
  }

  return {
    value: "pending" as const,
    label: "Čeká",
    detail: input.processingStartedAt
      ? `První pokus běží od ${formatDateTimeLabel(input.processingStartedAt)}`
      : `Ve frontě od ${formatDateTimeLabel(input.nextAttemptAt)}`,
    needsAttention: false,
  };
}

export function getErrorSummary(errorMessage: string | null) {
  if (!errorMessage) {
    return null;
  }

  const summary = errorMessage
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return summary ?? "Chyba bez detailu.";
}

export function emailTypeLabel(type: EmailLogType, templateKey: string): string {
  if (templateKey === "booking-confirmation-v1") {
    return "Přijetí rezervace";
  }

  if (templateKey === "booking-approved-v1") {
    return "Potvrzení rezervace";
  }

  switch (type) {
    case EmailLogType.BOOKING_CREATED:
      return "Notifikace nové rezervace";
    case EmailLogType.BOOKING_RECEIVED:
      return "Přijetí rezervace";
    case EmailLogType.BOOKING_CONFIRMED:
      return "Potvrzení rezervace";
    case EmailLogType.BOOKING_CANCELLED:
      return "Storno potvrzení";
    case EmailLogType.BOOKING_RESCHEDULED:
      return "Přesun termínu";
    case EmailLogType.BOOKING_REMINDER:
      return "Připomínka termínu";
    case EmailLogType.VOUCHER_SENT:
      return "Odeslání voucheru";
    case EmailLogType.GENERIC:
      return "Obecný e-mail";
  }

  return "Neznámý typ e-mailu";
}

export function actionTokenTypeLabel(type: BookingActionTokenType): string {
  switch (type) {
    case BookingActionTokenType.CANCEL:
      return "Storno token";
    case BookingActionTokenType.RESCHEDULE:
      return "Přesun termínu";
    case BookingActionTokenType.APPROVE:
      return "Schválení z e-mailu";
    case BookingActionTokenType.REJECT:
      return "Zrušení z e-mailu";
  }

  return "Neznámý action token";
}

export function getEmailLogSeverity(input: {
  status: EmailLogStatus;
  processingStartedAt: Date | null;
  attemptCount: number;
  staleBefore: Date;
} & EmailTrackingInput): "info" | "success" | "warning" | "error" {
  const tracking = deriveTrackingState(input);

  if (tracking.value === "failed" || input.status === EmailLogStatus.FAILED) return "error";
  if (tracking.value === "retry") return "warning";
  if (input.processingStartedAt && input.processingStartedAt < input.staleBefore) return "warning";
  if (input.attemptCount > 0 && input.status === EmailLogStatus.PENDING) return "warning";
  return input.status === EmailLogStatus.SENT ? "success" : "info";
}

type EmailRecentStatusValue = "sent" | "pending" | "processing" | "retry" | "failed";

export function getEmailRecentStatus(
  status: EmailLogStatus,
  processingStartedAt: Date | null,
  attemptCount: number,
): EmailRecentStatusValue {
  if (status === EmailLogStatus.SENT) {
    return "sent";
  }

  if (status === EmailLogStatus.FAILED) {
    return "failed";
  }

  if (processingStartedAt) {
    return "processing";
  }

  if (attemptCount > 0) {
    return "retry";
  }

  return "pending";
}

export function getEmailRecentStatusLabel(
  status: EmailLogStatus,
  processingStartedAt: Date | null,
  attemptCount: number,
): string {
  switch (getEmailRecentStatus(status, processingStartedAt, attemptCount)) {
    case "sent":
      return "Odesláno";
    case "pending":
      return "Čeká";
    case "processing":
      return "Zpracovává se";
    case "retry":
      return "Retry";
    case "failed":
      return "Selhalo";
  }
}

export function getWorkerSummary({
  pending,
  retrying,
  processing,
  failed,
}: {
  pending: number;
  retrying: number;
  processing: number;
  failed: number;
}) {
  if (processing > 0) {
    return `Worker právě drží ${processing} ${processing === 1 ? "zprávu" : processing < 5 ? "zprávy" : "zpráv"} v claimu.`;
  }

  if (pending > 0 || retrying > 0) {
    return "Ve frontě jsou čekající zprávy, ale aktuálně není vidět aktivní claim workeru.";
  }

  if (failed > 0) {
    return "Fronta je prázdná, ale zůstávají aktivní e-mailové incidenty k dořešení nebo ručnímu retry.";
  }

  return "Fronta je čistá a worker momentálně nedrží žádný aktivní job.";
}

export type EmailLogDetailData = {
  id: string;
  status: EmailLogStatus;
  statusLabel: string;
  finalStatus: "sent" | "pending" | "retry" | "failed";
  finalStatusLabel: string;
  finalStatusDetail: string;
  statusNeedsAttention: boolean;
  type: EmailLogType;
  typeLabel: string;
  recipientEmail: string;
  subject: string;
  businessTitle: string;
  templateKey: string;
  attemptCount: number;
  queueStateLabel: string;
  isProcessing: boolean;
  isStuck: boolean;
  canRetry: boolean;
  canRelease: boolean;
  nextAttemptLabel: string;
  processingStartedLabel: string;
  sentAtLabel: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  providerLabel: string;
  providerMessageIdLabel: string;
  transportStatusLabel: string;
  deliveryStatusLabel: string;
  errorMessage: string | null;
  errorSummary: string | null;
  payload: Prisma.JsonValue | null;
  bookingSummary: string;
  bookingHref: string | null;
  bookingTitle: string;
  bookingScheduleLabel: string;
  clientName: string;
  clientSummary: string;
  clientContactEmail: string | null;
  correctRecipientClientId: string | null;
  canResend: boolean;
  canCloseIncident: boolean;
  incidentResolution: {
    label: string;
    detail: string;
  } | null;
  actionTokenId: string | null;
  actionTokenLabel: string;
  actionTokenSummary: string;
  lastAttemptLabel: string;
  headerTimestampLabel: string;
  headerTimestampTitle: string;
};
