import { EmailLogStatus, type Prisma } from "@prisma/client";

export function isEmailDeliveryFailure(input: {
  status: EmailLogStatus;
  trackingBouncedAt: Date | null;
  trackingFailedAt: Date | null;
  trackingSuppressedAt: Date | null;
}) {
  return input.status === EmailLogStatus.FAILED
    || input.trackingBouncedAt !== null
    || input.trackingFailedAt !== null
    || input.trackingSuppressedAt !== null;
}

/** Historický definitivní failure bez ohledu na stav navazujícího resendu. */
export function getEmailDeliveryFailureWhere(): Prisma.EmailLogWhereInput {
  return {
    OR: [
      { status: EmailLogStatus.FAILED },
      { trackingBouncedAt: { not: null } },
      { trackingFailedAt: { not: null } },
      { trackingSuppressedAt: { not: null } },
    ],
  };
}

/** Aktivní incident: failure, který dosud neuzavřel doručený explicitní resend. */
export function getUnresolvedEmailDeliveryFailureWhere(): Prisma.EmailLogWhereInput {
  return {
    AND: [
      getEmailDeliveryFailureWhere(),
      {
        OR: [
          { resendRootId: null, incidentResolvedAt: null },
          { resendRoot: { is: { incidentResolvedAt: null } } },
        ],
      },
    ],
  };
}
