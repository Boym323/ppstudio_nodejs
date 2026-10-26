import { BookingStatus, EmailAudience, EmailIncidentResolutionKind, EmailLogStatus } from "@/generated/prisma/client";

import { getAdminBookingHref } from "@/features/admin/lib/booking/booking-display";
import { formatClientPhoneForDisplay } from "@/features/booking/lib/client-phone";
import { isEmailWorkerClaimStale } from "@/lib/email/booking-delivery-fence";
import { deriveTrackingState } from "@/lib/email/resend-webhooks";
import { getEmailDeliveryFailureWhere, isEmailDeliveryFailure } from "@/lib/email/incidents";
import { prisma } from "@/lib/prisma";

import {
  actionTokenTypeLabel,
  emailTypeLabel,
  formatDateTimeLabel,
  formatTimeRange,
  getEmailDetailFinalStatus,
  getErrorSummary,
  manualIncidentResolutionReasonLabel,
  retryStateLabel,
  statusLabel,
  type EmailLogDetailData,
} from "./email-log-presentations";

export async function getEmailLogDetailData(emailLogId: string): Promise<EmailLogDetailData | null> {
  const now = new Date();
  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
    include: {
      booking: {
        select: {
          id: true,
          clientNameSnapshot: true,
          clientEmailSnapshot: true,
          serviceNameSnapshot: true,
          scheduledStartsAt: true,
          scheduledEndsAt: true,
          status: true,
          communicationGeneration: true,
        },
      },
      client: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          isActive: true,
        },
      },
      actionToken: {
        select: {
          id: true,
          type: true,
          expiresAt: true,
          usedAt: true,
          revokedAt: true,
        },
      },
      incidentManualResolvedByUser: {
        select: { name: true, email: true },
      },
      resendRoot: {
        select: {
          incidentResolvedAt: true,
          incidentResolvedByEmailLogId: true,
          incidentResolutionKind: true,
          incidentManualResolutionReason: true,
          incidentManualResolutionNote: true,
          incidentManualResolvedByUser: {
            select: { name: true, email: true },
          },
        },
      },
      incidentResends: {
        where: getEmailDeliveryFailureWhere(),
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!emailLog) {
    return null;
  }

  const processingStartedAt = emailLog.processingStartedAt;
  const isProcessing = processingStartedAt !== null;
  const isStuck = isEmailWorkerClaimStale(processingStartedAt, now);
  const finalStatus = getEmailDetailFinalStatus(emailLog);
  const tracking = deriveTrackingState(emailLog);
  const bookingTitle = emailLog.booking?.serviceNameSnapshot ?? "Bez navázané rezervace";
  const bookingScheduleLabel = emailLog.booking
    ? formatTimeRange(emailLog.booking.scheduledStartsAt, emailLog.booking.scheduledEndsAt)
    : "Bez termínu rezervace";
  const clientName = emailLog.booking?.clientNameSnapshot ?? emailLog.client?.fullName ?? "Bez klientky";
  const lastAttemptLabel = formatDateTimeLabel(emailLog.sentAt ?? emailLog.updatedAt);
  const incidentRoot = emailLog.resendRoot ?? emailLog;
  const incidentIsActive = incidentRoot.incidentResolvedAt === null
    && (isEmailDeliveryFailure(emailLog)
      || (emailLog.resendRootId === null && emailLog.incidentResends.length > 0));
  const incidentResolutionKind = incidentRoot.incidentResolutionKind
    ?? (incidentRoot.incidentResolvedByEmailLogId ? EmailIncidentResolutionKind.DELIVERED_RESEND : null);
  const incidentResolution = incidentRoot.incidentResolvedAt && incidentResolutionKind
    ? incidentResolutionKind === EmailIncidentResolutionKind.MANUAL
      ? {
          label: "Ručně uzavřeno",
          detail: `${formatDateTimeLabel(incidentRoot.incidentResolvedAt)} • ${incidentRoot.incidentManualResolvedByUser?.name ?? incidentRoot.incidentManualResolvedByUser?.email ?? "Neznámý OWNER"} • ${manualIncidentResolutionReasonLabel(incidentRoot.incidentManualResolutionReason)}${incidentRoot.incidentManualResolutionNote ? ` • ${incidentRoot.incidentManualResolutionNote}` : ""}`,
        }
      : {
          label: "Vyřešeno následným odesláním",
          detail: `${formatDateTimeLabel(incidentRoot.incidentResolvedAt)} • doručený explicitní resend`,
        }
    : null;

  return {
    id: emailLog.id,
    status: emailLog.status,
    statusLabel: statusLabel(emailLog.status),
    finalStatus: finalStatus.value,
    finalStatusLabel: finalStatus.label,
    finalStatusDetail: finalStatus.detail,
    statusNeedsAttention: finalStatus.needsAttention,
    type: emailLog.type,
    typeLabel: emailTypeLabel(emailLog.type, emailLog.templateKey),
    recipientEmail: emailLog.recipientEmail,
    subject: emailLog.subject,
    businessTitle: emailLog.subject,
    templateKey: emailLog.templateKey,
    attemptCount: emailLog.attemptCount,
    queueStateLabel: retryStateLabel(
      emailLog.nextAttemptAt,
      emailLog.processingStartedAt,
      emailLog.attemptCount,
    ),
    isProcessing,
    isStuck,
    canRetry: emailLog.status === EmailLogStatus.PENDING && !isProcessing,
    canRelease: emailLog.status === EmailLogStatus.PENDING
      && isStuck
      && emailLog.processingToken !== null,
    nextAttemptLabel: formatDateTimeLabel(emailLog.nextAttemptAt),
    processingStartedLabel: formatDateTimeLabel(emailLog.processingStartedAt),
    sentAtLabel: formatDateTimeLabel(emailLog.sentAt),
    createdAtLabel: formatDateTimeLabel(emailLog.createdAt),
    updatedAtLabel: formatDateTimeLabel(emailLog.updatedAt),
    providerLabel: emailLog.provider ?? "Bez providera",
    providerMessageIdLabel: emailLog.providerMessageId ?? "Bez message id",
    transportStatusLabel: emailLog.status === EmailLogStatus.SENT ? "Úspěšné" : statusLabel(emailLog.status),
    deliveryStatusLabel: tracking.value === "pending" && emailLog.status === EmailLogStatus.SENT
      ? "Bez potvrzení od providera"
      : tracking.value === "failed" ? finalStatus.detail : tracking.label,
    errorMessage: emailLog.errorMessage,
    errorSummary: getErrorSummary(emailLog.errorMessage),
    payload: emailLog.payload,
    bookingSummary: emailLog.booking
      ? `${emailLog.booking.clientNameSnapshot} • ${emailLog.booking.serviceNameSnapshot} • ${bookingScheduleLabel}`
      : "Bez navázané rezervace",
    bookingHref: emailLog.booking ? getAdminBookingHref("owner", emailLog.booking.id) : null,
    bookingTitle,
    bookingScheduleLabel,
    clientName,
    clientSummary: emailLog.client
      ? `${emailLog.client.fullName} • ${emailLog.client.email ?? "Bez e-mailu"}${emailLog.client.phone ? ` • ${formatClientPhoneForDisplay(emailLog.client.phone)}` : ""}`
      : "Bez navázaného klienta",
    clientContactEmail: emailLog.client?.email ?? null,
    correctRecipientClientId: incidentIsActive && isEmailDeliveryFailure(emailLog)
      && emailLog.audience === EmailAudience.CLIENT && !isProcessing && emailLog.client
      && (!emailLog.bookingId || (emailLog.booking
        && (emailLog.booking.status === BookingStatus.PENDING || emailLog.booking.status === BookingStatus.CONFIRMED)
        && emailLog.booking.scheduledStartsAt >= now
        && emailLog.booking.communicationGeneration === emailLog.communicationGeneration))
      ? emailLog.client.id : null,
    canResend: !isProcessing,
    canCloseIncident: incidentIsActive,
    incidentResolution,
    actionTokenId: emailLog.actionToken?.id ?? null,
    actionTokenLabel: emailLog.actionToken ? actionTokenTypeLabel(emailLog.actionToken.type) : "Bez navázaného action tokenu",
    actionTokenSummary: emailLog.actionToken
      ? `${actionTokenTypeLabel(emailLog.actionToken.type)} • expirace ${formatDateTimeLabel(emailLog.actionToken.expiresAt)}${emailLog.actionToken.usedAt ? ` • použito ${formatDateTimeLabel(emailLog.actionToken.usedAt)}` : ""}${emailLog.actionToken.revokedAt ? ` • zrušeno ${formatDateTimeLabel(emailLog.actionToken.revokedAt)}` : ""}`
      : "Bez navázaného action tokenu",
    lastAttemptLabel,
    headerTimestampLabel: emailLog.sentAt ? formatDateTimeLabel(emailLog.sentAt) : lastAttemptLabel,
    headerTimestampTitle: emailLog.sentAt ? "Odesláno" : "Poslední pokus",
  };
}
