import "server-only";

import { AvailabilitySlotStatus, BookingPaymentStatus, BookingStatus } from "@/generated/prisma/browser";

import { getAdminSectionPath } from "@/features/admin/lib/admin-paths";
import { getKpiDateKey, getKpiDateRanges, getKpiPercentChange, getKpiPeriodStart, getKpiExpectedRevenueRange, getKpiSeriesPeriodStarts, usesMonthlyKpiBuckets } from "@/features/admin/lib/kpi-date-range";
import { calculateExpectedRevenue } from "@/features/admin/lib/kpi-expected-revenue";
import { aggregateAcquisition } from "@/features/admin/lib/kpi-acquisition";
import { getKpiClientMetrics } from "@/features/admin/lib/kpi-client-metrics";
import { calculateKpiOccupancy, mergeKpiTimeIntervals } from "@/features/admin/lib/kpi-occupancy";
import { getKpiMetricPreviousAvailability } from "@/features/admin/lib/kpi-metric-availability";
import { calculateDisruptionMetrics } from "@/features/admin/lib/kpi-disruption-metrics";
import { aggregateServiceMetrics } from "@/features/admin/lib/kpi-service-metrics";
import { getRetentionBand, getRetentionBandLabel, type RetentionBand } from "@/features/admin/lib/kpi-retention";
import { completeKpiTimeSeries, sortKpiTimeSeries } from "@/features/admin/lib/kpi-time-series";
import { type KpiDashboardData, type KpiDateRange, type KpiMetric } from "@/features/admin/types/kpi-dashboard";
import { loadAutoLunchPolicySnapshot } from "@/features/booking/lib/booking-auto-lunch-policy";
import { getPragueLocalDate } from "@/features/booking/lib/booking-local-time";
import { AUTO_LUNCH_POLICY, generateLunchCandidates, shouldApplyAutoLunch } from "@/features/booking/lib/booking-schedule-optimization";
import { prisma } from "@/lib/prisma";

const completed = BookingStatus.COMPLETED;
const inRange = (date: Date, range: KpiDateRange) => date >= range.start && date < range.end;
const metric = (value: number, previousValue: number, previousHasData: boolean): KpiMetric => ({ value, previousValue, previousHasData, difference: value - previousValue, change: previousHasData ? getKpiPercentChange(value, previousValue) : null });

type BookingRow = Awaited<ReturnType<typeof getBookings>>[number];
async function getBookings(start: Date, end: Date) {
  return prisma.booking.findMany({
    where: { scheduledStartsAt: { gte: start, lt: end } },
    orderBy: { scheduledStartsAt: "asc" },
    select: { id: true, clientId: true, status: true, isManual: true, manualOverride: true, scheduledStartsAt: true, scheduledEndsAt: true, blockedUntil: true, serviceNameSnapshot: true, serviceDurationMinutes: true, finalPriceCzk: true, servicePriceFromCzk: true, acquisitionSource: true, acquisitionUtmSource: true, acquisitionUtmMedium: true, acquisitionUtmCampaign: true, slot: { select: { publishedAt: true } }, payments: { select: { amountCzk: true, status: true } }, voucherRedemptions: { select: { amountCzk: true } } },
  });
}

function getOccupancyLunchMinutes(
  slots: Array<{ startsAt: Date; endsAt: Date }>,
  visits: Array<Pick<BookingRow, "scheduledStartsAt" | "scheduledEndsAt" | "blockedUntil">>,
  policy: Awaited<ReturnType<typeof loadAutoLunchPolicySnapshot>>,
) {
  const days = new Map<string, { availability: Array<{ startsAt: number; endsAt: number }>; bookedBlocks: Array<{ startsAt: number; endsAt: number }> }>();
  const day = (date: Date) => {
    const dateKey = getPragueLocalDate(date);
    const current = days.get(dateKey) ?? { availability: [], bookedBlocks: [] };
    days.set(dateKey, current);
    return { dateKey, current };
  };

  for (const slot of slots) {
    const { current } = day(slot.startsAt);
    current.availability.push({ startsAt: slot.startsAt.getTime(), endsAt: slot.endsAt.getTime() });
  }
  for (const visit of visits) {
    const { current } = day(visit.scheduledStartsAt);
    current.bookedBlocks.push({ startsAt: visit.scheduledStartsAt.getTime(), endsAt: (visit.blockedUntil ?? visit.scheduledEndsAt).getTime() });
  }

  return [...days.entries()].reduce((total, [localDate, dayData]) => {
    const active = shouldApplyAutoLunch({
      localDate,
      availability: dayData.availability,
      bookedBlocks: dayData.bookedBlocks,
      globalAutoLunchEnabled: policy.globalAutoLunchEnabled,
      dayLunchMode: policy.dayLunchModes[localDate] ?? "AUTO",
    });
    return total + (active && generateLunchCandidates({ localDate, availability: dayData.availability }).length ? AUTO_LUNCH_POLICY.durationMinutes : 0);
  }, 0);
}
async function getExpectedBookings(start: Date, end: Date) {
  return prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      scheduledStartsAt: { gte: start, lt: end },
    },
    select: {
      status: true,
      scheduledStartsAt: true,
      finalPriceCzk: true,
      servicePriceFromCzk: true,
    },
  });
}
function price(row: BookingRow) { return row.finalPriceCzk ?? row.servicePriceFromCzk ?? 0; }
function summarize(
  rows: BookingRow[],
  range: KpiDateRange,
  allCompleted: Array<Pick<BookingRow, "clientId" | "scheduledStartsAt">>,
) {
  const listed = rows.filter((row) => inRange(row.scheduledStartsAt, range));
  const visits = listed.filter((row) => row.status === completed);
  const revenue = visits.reduce((sum, row) => sum + price(row), 0);
  const clientMetrics = getKpiClientMetrics(allCompleted, range);
  const disruptions = calculateDisruptionMetrics(listed.map((row) => ({
    status: row.status,
    slotPublishedAt: row.slot?.publishedAt ?? null,
    finalPriceCzk: row.finalPriceCzk,
    servicePriceFromCzk: row.servicePriceFromCzk,
  })));
  const outstanding = visits.reduce((sum, row) => {
    const directPaidCzk = row.payments.reduce(
      (payments, payment) => payments + (payment.status === BookingPaymentStatus.VOIDED ? 0 : payment.amountCzk),
      0,
    );
    const voucherPaidCzk = row.voucherRedemptions.reduce((redemptions, redemption) => redemptions + (redemption.amountCzk ?? 0), 0);
    return sum + Math.max(0, price(row) - directPaidCzk - voucherPaidCzk);
  }, 0);
  return { listed, visits, revenue, clientMetrics, disruptions, noShowValue: disruptions.noShowValue, outstanding };
}

export async function getKpiDashboardData(area: "owner" | "salon", searchParams?: Record<string, string | string[] | undefined>): Promise<KpiDashboardData> {
  const { current, previous } = getKpiDateRanges(searchParams);
  const now = new Date();
  const retentionReference = new Date(Math.min(now.getTime(), current.end.getTime() - 1));
  const expectedRange = getKpiExpectedRevenueRange(current, now);
  const expectedIsHistorical = current.end <= now;
  const [periodRows, allCompleted, slots, activeClients, expectedBookings] = await Promise.all([
    getBookings(previous.start, current.end),
    prisma.booking.findMany({ where: { status: completed, scheduledStartsAt: { lt: current.end } }, select: { clientId: true, scheduledStartsAt: true } }),
    prisma.availabilitySlot.findMany({ where: { status: { in: [AvailabilitySlotStatus.PUBLISHED, AvailabilitySlotStatus.ARCHIVED] }, publishedAt: { not: null }, startsAt: { lt: current.end }, endsAt: { gt: previous.start } }, select: { startsAt: true, endsAt: true } }),
    prisma.client.findMany({ where: { isActive: true, bookings: { some: { status: completed, scheduledStartsAt: { lt: retentionReference } } } }, select: { id: true, bookings: { where: { status: completed, scheduledStartsAt: { lt: retentionReference } }, orderBy: { scheduledStartsAt: "desc" }, take: 1, select: { scheduledStartsAt: true } } } }),
    expectedRange ? getExpectedBookings(expectedRange.start, expectedRange.end) : Promise.resolve([]),
  ]);
  const allCompletedRows = allCompleted.map((row) => ({ clientId: row.clientId, scheduledStartsAt: row.scheduledStartsAt }));
  const extendedRows = periodRows as BookingRow[];
  const currentSummary = summarize(extendedRows, current, allCompletedRows);
  const previousSummary = summarize(extendedRows, previous, allCompletedRows);
  const occupancy = async (summary: ReturnType<typeof summarize>, range: KpiDateRange) => {
    const occupancySlots = mergeKpiTimeIntervals(slots, range);
    const completedWork = summary.visits.map((row) => ({ startsAt: row.scheduledStartsAt, endsAt: row.blockedUntil ?? row.scheduledEndsAt }));
    const manualCompletedWork = summary.visits.filter((row) => row.isManual || row.manualOverride).map((row) => ({ startsAt: row.scheduledStartsAt, endsAt: row.blockedUntil ?? row.scheduledEndsAt }));
    const localDates = occupancySlots.map((slot) => getPragueLocalDate(slot.startsAt));
    const policy = await loadAutoLunchPolicySnapshot(prisma, localDates);
    const lunchMinutes = getOccupancyLunchMinutes(occupancySlots, summary.visits, policy);
    return calculateKpiOccupancy({ publishedAvailability: occupancySlots, manualCompletedWork, completedWork, range, lunchMinutes });
  };
  const [currentOccupancy, previousOccupancy] = await Promise.all([
    occupancy(currentSummary, current),
    occupancy(previousSummary, previous),
  ]);
  const expectedRevenue = calculateExpectedRevenue(expectedBookings.map((booking) => ({
    status: booking.status,
    scheduledStartsAt: booking.scheduledStartsAt,
    finalPriceCzk: booking.finalPriceCzk,
    servicePriceFromCzk: booking.servicePriceFromCzk,
  })), expectedRange);
  const buckets = new Map<number, { periodStart: Date; revenue: number; completed: number; cancelled: number; noShow: number }>();
  const monthly = usesMonthlyKpiBuckets(current);
  for (const row of currentSummary.listed) {
    const periodStart = getKpiPeriodStart(row.scheduledStartsAt, monthly);
    const bucket = buckets.get(periodStart.getTime()) ?? { periodStart, revenue: 0, completed: 0, cancelled: 0, noShow: 0 };
    if (row.status === completed) { bucket.completed += 1; bucket.revenue += price(row); }
    if (row.status === BookingStatus.CANCELLED) bucket.cancelled += 1;
    if (row.status === BookingStatus.NO_SHOW) bucket.noShow += 1;
    buckets.set(periodStart.getTime(), bucket);
  }
  const services = aggregateServiceMetrics(currentSummary.visits.map((row) => ({
    serviceName: row.serviceNameSnapshot,
    finalPriceCzk: row.finalPriceCzk,
    servicePriceFromCzk: row.servicePriceFromCzk,
    scheduledStartsAt: row.scheduledStartsAt,
    scheduledEndsAt: row.scheduledEndsAt,
  })));
  const acquisition = aggregateAcquisition(currentSummary.listed.map((row) => ({
    acquisitionSource: row.acquisitionSource,
    utmSource: row.acquisitionUtmSource,
    utmMedium: row.acquisitionUtmMedium,
    utmCampaign: row.acquisitionUtmCampaign,
    isCompleted: row.status === completed,
    bookingValue: price(row),
  })));
  const baseClientHref = getAdminSectionPath(area, "klienti");
  const orderedBuckets = sortKpiTimeSeries(
    [...buckets.values()].map((bucket) => ({ ...bucket, periodStart: bucket.periodStart.toISOString() })),
  );
  const completeBuckets = completeKpiTimeSeries(
    getKpiSeriesPeriodStarts(current, monthly),
    orderedBuckets,
    (periodStart) => ({ periodStart, revenue: 0, completed: 0, cancelled: 0, noShow: 0 }),
  );
  const previousAvailability = getKpiMetricPreviousAvailability({
    completedCount: previousSummary.visits.length,
    completedClientCount: new Set(previousSummary.visits.flatMap((row) => row.clientId ? [row.clientId] : [])).size,
    physicalAvailabilityMinutes: previousOccupancy.bookableMinutes,
    relevantDisruptionCount: previousSummary.disruptions.relevantCount,
  });
  return { range: current, previousRange: previous, calculatedAt: now, metrics: {
    revenue: metric(currentSummary.revenue, previousSummary.revenue, previousAvailability.periodTotals), completed: metric(currentSummary.visits.length, previousSummary.visits.length, previousAvailability.periodTotals), averageSpend: metric(currentSummary.visits.length ? currentSummary.revenue / currentSummary.visits.length : 0, previousSummary.visits.length ? previousSummary.revenue / previousSummary.visits.length : 0, previousAvailability.averageSpend), occupancy: metric(currentOccupancy.percent, previousOccupancy.percent, previousAvailability.occupancy), newClients: metric(currentSummary.clientMetrics.newClients, previousSummary.clientMetrics.newClients, previousAvailability.periodTotals), returningClients: metric(currentSummary.clientMetrics.returningClients, previousSummary.clientMetrics.returningClients, previousAvailability.periodTotals), repeatVisitClients: metric(currentSummary.clientMetrics.repeatVisitClients, previousSummary.clientMetrics.repeatVisitClients, previousAvailability.periodTotals), repeatVisitRate: metric(currentSummary.clientMetrics.repeatVisitRate, previousSummary.clientMetrics.repeatVisitRate, previousAvailability.repeatVisitRate), cancellations: metric(currentSummary.disruptions.cancellations, previousSummary.disruptions.cancellations, previousAvailability.periodTotals), cancellationRate: metric(currentSummary.disruptions.cancellationRate, previousSummary.disruptions.cancellationRate, previousAvailability.disruptionRates), cancellationValue: metric(currentSummary.disruptions.cancellationValue, previousSummary.disruptions.cancellationValue, previousAvailability.periodTotals), noShows: metric(currentSummary.disruptions.noShows, previousSummary.disruptions.noShows, previousAvailability.periodTotals), noShowRate: metric(currentSummary.disruptions.noShowRate, previousSummary.disruptions.noShowRate, previousAvailability.disruptionRates), noShowValue: metric(currentSummary.disruptions.noShowValue, previousSummary.noShowValue, previousAvailability.periodTotals), expectedRevenue: metric(expectedRevenue.amount, 0, previousAvailability.expectedRevenue), outstanding: metric(currentSummary.outstanding, previousSummary.outstanding, previousAvailability.outstanding),
  }, revenueSeries: completeBuckets.map(({ periodStart, revenue }) => ({ periodStart, label: getKpiDateKey(new Date(periodStart), monthly), revenue })), bookingSeries: completeBuckets.map(({ periodStart, completed, cancelled, noShow }) => ({ periodStart, label: getKpiDateKey(new Date(periodStart), monthly), completed, cancelled, noShow })), services, clientMix: { newClients: currentSummary.clientMetrics.newClients, returningClients: currentSummary.clientMetrics.returningClients }, retention: (["8_11", "12_15", "16_plus"] as RetentionBand[]).map((band) => ({ band, label: getRetentionBandLabel(band), count: activeClients.filter((client) => getRetentionBand(client.bookings[0]?.scheduledStartsAt ?? null, retentionReference) === band).length, href: `${baseClientHref}?retention=${band}&retentionAt=${retentionReference.getTime()}` })), retentionReference, acquisition, expectedRevenue: { bookingCount: expectedRevenue.bookingCount, missingPriceCount: expectedRevenue.missingPriceCount, isHistorical: expectedIsHistorical }, unavailable: { hasData: currentSummary.listed.length > 0 } };
}
