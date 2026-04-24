import {
  BookingActionTokenType,
  BookingStatus,
  EmailLogStatus,
  EmailLogType,
  Prisma,
} from "@prisma/client";

import { env } from "@/config/env";
import {
  buildBookingActionExpiry,
  buildBookingActionToken,
  buildBookingCancellationUrl,
  buildBookingEmailActionExpiry,
  buildBookingEmailActionUrl,
  buildBookingManagementUrl,
} from "@/features/booking/lib/booking-action-tokens";

export async function createNotificationEmailLogs(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    clientId: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string;
    serviceName: string;
    scheduledStartsAt: Date;
    scheduledEndsAt: Date;
    now: Date;
    status: "PENDING" | "CONFIRMED";
    sendClientEmail: boolean;
    includeCalendarAttachment: boolean;
    sendAdminNotification: boolean;
    adminNotificationEmail: string;
  },
) {
  const createdEmailLogIds: string[] = [];
  const rescheduleToken = buildBookingActionToken();
  const cancellationToken = buildBookingActionToken();
  const rescheduleActionToken = await tx.bookingActionToken.create({
    data: {
      bookingId: input.bookingId,
      type: BookingActionTokenType.RESCHEDULE,
      tokenHash: rescheduleToken.tokenHash,
      expiresAt: buildBookingActionExpiry(input.now),
      lastSentAt: input.sendClientEmail ? input.now : null,
    },
    select: {
      id: true,
    },
  });

  await tx.bookingActionToken.create({
    data: {
      bookingId: input.bookingId,
      type: BookingActionTokenType.CANCEL,
      tokenHash: cancellationToken.tokenHash,
      expiresAt: buildBookingActionExpiry(input.now),
      lastSentAt: input.sendClientEmail ? input.now : null,
    },
  });

  const manageReservationUrl = buildBookingManagementUrl(rescheduleToken.rawToken);
  const cancellationUrl = buildBookingCancellationUrl(cancellationToken.rawToken);

  if (input.sendClientEmail) {
    const clientEmailLog = await tx.emailLog.create({
      data: {
        bookingId: input.bookingId,
        clientId: input.clientId,
        actionTokenId: rescheduleActionToken.id,
        type: EmailLogType.BOOKING_CONFIRMED,
        status: env.EMAIL_DELIVERY_MODE === "background" ? undefined : EmailLogStatus.SENT,
        attemptCount: env.EMAIL_DELIVERY_MODE === "background" ? undefined : 1,
        nextAttemptAt: env.EMAIL_DELIVERY_MODE === "background" ? input.now : undefined,
        processingStartedAt: null,
        processingToken: null,
        recipientEmail: input.clientEmail,
        subject:
          input.status === BookingStatus.CONFIRMED
            ? `Rezervace potvrzena: ${input.serviceName}`
            : `Přijetí rezervace: ${input.serviceName}`,
        templateKey:
          input.status === BookingStatus.CONFIRMED
            ? "booking-approved-v1"
            : "booking-confirmation-v1",
        payload:
          input.status === BookingStatus.CONFIRMED
            ? {
                bookingId: input.bookingId,
                serviceName: input.serviceName,
                clientName: input.clientName,
                scheduledStartsAt: input.scheduledStartsAt.toISOString(),
                scheduledEndsAt: input.scheduledEndsAt.toISOString(),
                manageReservationUrl,
                includeCalendarAttachment: input.includeCalendarAttachment,
              }
            : {
                bookingId: input.bookingId,
                serviceName: input.serviceName,
                clientName: input.clientName,
                scheduledStartsAt: input.scheduledStartsAt.toISOString(),
                scheduledEndsAt: input.scheduledEndsAt.toISOString(),
                manageReservationUrl,
                cancellationUrl,
              },
        provider: env.EMAIL_DELIVERY_MODE === "background" ? undefined : "log",
        sentAt: env.EMAIL_DELIVERY_MODE === "background" ? undefined : input.now,
      },
    });
    createdEmailLogIds.push(clientEmailLog.id);
  }

  if (
    input.sendAdminNotification &&
    input.status === BookingStatus.PENDING &&
    input.adminNotificationEmail.trim().length > 0
  ) {
    const approveToken = buildBookingActionToken();
    const rejectToken = buildBookingActionToken();
    const approveUrl = buildBookingEmailActionUrl("approve", approveToken.rawToken);
    const rejectUrl = buildBookingEmailActionUrl("reject", rejectToken.rawToken);
    const adminUrl = `${env.NEXT_PUBLIC_APP_URL}/admin/rezervace/${input.bookingId}`;

    await tx.bookingActionToken.createMany({
      data: [
        {
          bookingId: input.bookingId,
          type: BookingActionTokenType.APPROVE,
          tokenHash: approveToken.tokenHash,
          expiresAt: buildBookingEmailActionExpiry(input.now),
          lastSentAt: input.now,
        },
        {
          bookingId: input.bookingId,
          type: BookingActionTokenType.REJECT,
          tokenHash: rejectToken.tokenHash,
          expiresAt: buildBookingEmailActionExpiry(input.now),
          lastSentAt: input.now,
        },
      ],
    });

    const adminEmailLog = await tx.emailLog.create({
      data: {
        bookingId: input.bookingId,
        clientId: input.clientId,
        type: EmailLogType.BOOKING_CREATED,
        status: env.EMAIL_DELIVERY_MODE === "background" ? undefined : EmailLogStatus.SENT,
        attemptCount: env.EMAIL_DELIVERY_MODE === "background" ? undefined : 1,
        nextAttemptAt: env.EMAIL_DELIVERY_MODE === "background" ? input.now : undefined,
        processingStartedAt: null,
        processingToken: null,
        recipientEmail: input.adminNotificationEmail,
        subject: `Nová rezervace: ${input.serviceName}`,
        templateKey: "admin-booking-notification-v1",
        payload: {
          bookingId: input.bookingId,
          serviceName: input.serviceName,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          clientPhone: input.clientPhone,
          scheduledStartsAt: input.scheduledStartsAt.toISOString(),
          scheduledEndsAt: input.scheduledEndsAt.toISOString(),
          approveUrl,
          rejectUrl,
          adminUrl,
        },
        provider: env.EMAIL_DELIVERY_MODE === "background" ? undefined : "log",
        sentAt: env.EMAIL_DELIVERY_MODE === "background" ? undefined : input.now,
      },
    });
    createdEmailLogIds.push(adminEmailLog.id);
  }

  return {
    manageReservationUrl,
    cancellationUrl,
    createdEmailLogIds,
  };
}
