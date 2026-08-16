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

/**
 * Logické aktivní incidenty, vždy jeden stabilní root za resend chain.
 * `failureWhere` určuje, který failure člen je pro konkrétní read-model relevantní.
 */
export function getUnresolvedEmailDeliveryIncidentRootWhere(
  failureWhere: Prisma.EmailLogWhereInput = getEmailDeliveryFailureWhere(),
): Prisma.EmailLogWhereInput {
  return {
    AND: [
      { resendRootId: null, incidentResolvedAt: null },
      {
        OR: [
          failureWhere,
          { incidentResends: { some: failureWhere } },
        ],
      },
    ],
  };
}
