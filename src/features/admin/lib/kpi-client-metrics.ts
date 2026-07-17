import { type KpiDateRange } from "@/features/admin/types/kpi-dashboard";

export type CompletedClientVisit = {
  clientId: string | null;
  scheduledStartsAt: Date;
  isCompleted?: boolean;
};

export type KpiClientMetrics = {
  newClients: number;
  returningClients: number;
  repeatVisitClients: number;
  repeatVisitRate: number;
};

/**
 * Počítá výhradně dokončené návštěvy předané volajícím. Záznam bez stabilního
 * clientId se záměrně ignoruje – nesmí se nebezpečně spojovat podle jména či kontaktu.
 */
export function getKpiClientMetrics(
  completedVisits: CompletedClientVisit[],
  range: KpiDateRange,
): KpiClientMetrics {
  const periodCounts = new Map<string, number>();
  const firstVisitAt = new Map<string, number>();
  const hasVisitBeforePeriod = new Set<string>();

  for (const visit of completedVisits) {
    if (visit.isCompleted === false || !visit.clientId) continue;

    const timestamp = visit.scheduledStartsAt.getTime();
    const first = firstVisitAt.get(visit.clientId);
    if (first === undefined || timestamp < first) firstVisitAt.set(visit.clientId, timestamp);

    if (visit.scheduledStartsAt < range.start) {
      hasVisitBeforePeriod.add(visit.clientId);
    }
    if (visit.scheduledStartsAt >= range.start && visit.scheduledStartsAt < range.end) {
      periodCounts.set(visit.clientId, (periodCounts.get(visit.clientId) ?? 0) + 1);
    }
  }

  let newClients = 0;
  let returningClients = 0;
  let repeatVisitClients = 0;
  for (const [clientId, count] of periodCounts) {
    if (firstVisitAt.get(clientId)! >= range.start.getTime()) newClients += 1;
    if (hasVisitBeforePeriod.has(clientId)) returningClients += 1;
    if (count >= 2) repeatVisitClients += 1;
  }

  return {
    newClients,
    returningClients,
    repeatVisitClients,
    repeatVisitRate: periodCounts.size ? (repeatVisitClients / periodCounts.size) * 100 : 0,
  };
}
