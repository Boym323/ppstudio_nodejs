import { Prisma } from "@/generated/prisma/client";
import {
  buildResendEmailLogCreateInput,
  resolveEmailLogRecipient,
  resolveResendIncidentRootId,
} from "@/features/admin/actions/email-log-action-helpers";
import { prisma } from "@/lib/prisma";

type ResendSourceEmailLog = Prisma.EmailLogGetPayload<{
  include: {
    client: { select: { id: true; email: true } };
    booking: { select: { id: true; clientEmailSnapshot: true } };
  };
}>;

/** Vlastní zápis nového logu; server action pouze ověřuje oprávnění a navigaci. */
export async function createResendEmailLog(input: {
  emailLog: ResendSourceEmailLog;
  adminNotificationEmail?: string | null;
}) {
  const { emailLog } = input;
  const recipientEmail = resolveEmailLogRecipient({
    audience: emailLog.audience,
    clientIsAvailable: emailLog.client !== null,
    clientEmail: emailLog.client?.email ?? null,
    bookingClientEmailSnapshot: emailLog.booking?.clientEmailSnapshot ?? null,
    originalRecipientEmail: emailLog.recipientEmail,
    adminNotificationEmail: input.adminNotificationEmail,
  });
  if (!recipientEmail) return null;

  const incidentRoot = emailLog.resendRootId
    ? await prisma.emailLog.findUnique({
        where: { id: emailLog.resendRootId },
        select: { incidentResolvedAt: true },
      })
    : emailLog;

  return prisma.emailLog.create({
    data: buildResendEmailLogCreateInput({
      resendOfId: emailLog.id,
      resendRootId: resolveResendIncidentRootId({
        sourceEmailLogId: emailLog.id,
        sourceResendRootId: emailLog.resendRootId,
        incidentResolvedAt: incidentRoot?.incidentResolvedAt ?? emailLog.incidentResolvedAt,
      }),
      bookingId: emailLog.bookingId,
      clientId: emailLog.clientId,
      actionTokenId: emailLog.actionTokenId,
      type: emailLog.type,
      audience: emailLog.audience,
      recipientEmail,
      subject: emailLog.subject,
      templateKey: emailLog.templateKey,
      payload: emailLog.payload,
    }),
  });
}
