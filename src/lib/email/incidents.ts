import { EmailLogStatus, type Prisma } from "@prisma/client";

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
