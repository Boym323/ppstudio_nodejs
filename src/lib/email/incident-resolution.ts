import {
  AdminRole,
  EmailIncidentManualResolutionReason,
  type PrismaClient,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isEmailDeliveryFailure } from "@/lib/email/incidents";

export const emailIncidentManualResolutionReasons = [
  EmailIncidentManualResolutionReason.HISTORICAL,
  EmailIncidentManualResolutionReason.CONTACTED_OTHER_WAY,
  EmailIncidentManualResolutionReason.NO_LONGER_RELEVANT,
  EmailIncidentManualResolutionReason.OTHER,
] as const;

export type ManualEmailIncidentResolutionInput = {
  emailLogId: string;
  actorUserId: string;
  actorRole: AdminRole;
  reason: EmailIncidentManualResolutionReason;
  note: string | null;
};

/**
 * Uzavírá stabilní root incidentu bez změny historického EmailLogu ani side effectů.
 * Podmínka v updateMany je záměrně idempotentní při dvojkliku i souběhu.
 */
export async function manuallyResolveEmailIncident(
  input: ManualEmailIncidentResolutionInput,
  database: Pick<PrismaClient, "emailLog"> = prisma,
) {
  if (input.actorRole !== AdminRole.OWNER) {
    return { outcome: "forbidden" as const };
  }

  const emailLog = await database.emailLog.findUnique({
    where: { id: input.emailLogId },
    select: { id: true, resendRootId: true },
  });

  if (!emailLog) {
    return { outcome: "missing" as const };
  }

  const rootId = emailLog.resendRootId ?? emailLog.id;
  const root = await database.emailLog.findUnique({
    where: { id: rootId },
    select: {
      status: true,
      trackingBouncedAt: true,
      trackingFailedAt: true,
      trackingSuppressedAt: true,
    },
  });

  if (!root || !isEmailDeliveryFailure(root)) {
    return { outcome: "not_an_incident" as const, rootId };
  }

  const updated = await database.emailLog.updateMany({
    where: { id: rootId, incidentResolvedAt: null },
    data: {
      incidentResolvedAt: new Date(),
      incidentResolutionKind: "MANUAL",
      incidentManualResolvedByUserId: input.actorUserId,
      incidentManualResolutionReason: input.reason,
      incidentManualResolutionNote: input.note,
    },
  });

  return { outcome: updated.count === 1 ? "resolved" as const : "already_resolved" as const, rootId };
}
