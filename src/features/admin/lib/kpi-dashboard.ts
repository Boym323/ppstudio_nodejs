import "server-only";

import { AvailabilitySlotStatus, BookingPaymentStatus, BookingStatus } from "@/generated/prisma/browser";

import { getAdminSectionPath } from "@/features/admin/lib/admin-paths";
import { getKpiDateKey, getKpiDateRanges, getKpiPercentChange, getKpiPeriodStart, getKpiExpectedRevenueRange, getKpiSeriesPeriodStarts } from "@/features/admin/lib/kpi-date-range";
import { calculateExpectedRevenue } from "@/features/admin/lib/kpi-expected-revenue";
import { aggregateAcquisition } from "@/features/admin/lib/kpi-acquisition";
import { getKpiClientMetrics } from "@/features/admin/lib/kpi-client-metrics";
import { calculateDisruptionMetrics } from "@/features/admin/lib/kpi-disruption-metrics";
import { aggregateServiceMetrics } from "@/features/admin/lib/kpi-service-metrics";
import { getRetentionBand, getRetentionBandLabel, type RetentionBand } from "@/features/admin/lib/kpi-retention";
import { completeKpiTimeSeries, sortKpiTimeSeries } from "@/features/admin/lib/kpi-time-series";
import { type KpiDashboardData, type KpiDateRange, type KpiMetric } from "@/features/admin/types/kpi-dashboard";
import { prisma } from "@/lib/prisma";

const completed = BookingStatus.COMPLETED;
const minute = 60_000;
const inRange = (date: Date, range: KpiDateRange) => date >= range.start && date < range.end;
const overlapMinutes = (start: Date, end: Date, range: KpiDateRange) => Math.max(0, Math.min(end.getTime(), range.end.getTime()) - Math.max(start.getTime(), range.start.getTime())) / minute;
const metric = (value: number, previousValue: number, previousHasData: boolean): KpiMetric => ({ value, previousValue, previousHasData, difference: value - previousValue, change: previousHasData ? getKpiPercentChange(value, previousValue) : null });

type BookingRow = Awaited<ReturnType<typeof getBookings>>[number];
async function getBookings(start: Date, end: Date) {
  return prisma.booking.findMany({
    where: { scheduledStartsAt: { gte: start, lt: end } },
    orderBy: { scheduledStartsAt: "asc" },
    select: { id: true, clientId: true, status: true, scheduledStartsAt: true, scheduledEndsAt: true, serviceNameSnapshot: true, serviceDurationMinutes: true, finalPriceCzk: true, servicePriceFromCzk: true, acquisitionSource: true, acquisitionUtmSource: true, acquisitionUtmMedium: true, acquisitionUtmCampaign: true, slot: { select: { publishedAt: true } }, payments: { select: { amountCzk: true, status: true } }, voucherRedemptions: { select: { amountCzk: true } } },
  });
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
    slotPublishedAt: row.slot.publishedAt,
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
  return { listed, visits, revenue, clientMetrics, disruptions, outstanding };
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
    prisma.availabilitySlot.findMany({ where: { status: { in: [AvailabilitySlotStatus.PUBLISHED, AvailabilitySlotStatus.ARCHIVED] }, publishedAt: { not: null }, startsAt: { lt: current.end }, endsAt: { gt: previous.start } }, select: { startsAt: true, endsAt: true, capacity: true } }),
    prisma.client.findMany({ where: { isActive: true, bookings: { some: { status: completed, scheduledStartsAt: { lt: retentionReference } } } }, select: { id: true, bookings: { where: { status: completed, scheduledStartsAt: { lt: retentionReference } }, orderBy: { scheduledStartsAt: "desc" }, take: 1, select: { scheduledStartsAt: true } } } }),
    expectedRange ? getExpectedBookings(expectedRange.start, expectedRange.end) : Promise.resolve([]),
  ]);
  const allCompletedRows = allCompleted.map((row) => ({ clientId: row.clientId, scheduledStartsAt: row.scheduledStartsAt }));
  const extendedRows = periodRows as BookingRow[];
  const currentSummary = summarize(extendedRows, current, allCompletedRows);
  const previousSummary = summarize(extendedRows, previous, allCompletedRows);
  const previousHasData = previousSummary.listed.length > 0;
  const occupancy = (summary: ReturnType<typeof summarize>, range: KpiDateRange) => {
    const available = slots.reduce((sum, slot) => sum + overlapMinutes(slot.startsAt, slot.endsAt, range) * Math.max(slot.capacity, 1), 0);
    const reserved = summary.visits.reduce((sum, row) => sum + overlapMinutes(row.scheduledStartsAt, row.scheduledEndsAt, range), 0);
    return available ? Math.min(100, (reserved / available) * 100) : 0;
  };
  const expectedRevenue = calculateExpectedRevenue(expectedBookings.map((booking) => ({
    status: booking.status,
    scheduledStartsAt: booking.scheduledStartsAt,
    finalPriceCzk: booking.finalPriceCzk,
    servicePriceFromCzk: booking.servicePriceFromCzk,
  })), expectedRange);
  const buckets = new Map<number, { periodStart: Date; revenue: number; completed: number; cancelled: number; noShow: number }>();
  const monthly = (current.end.getTime() - current.start.getTime()) / 86_400_000 > 62;
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
  return { range: current, previousRange: previous, calculatedAt: now, metrics: {
    revenue: metric(currentSummary.revenue, previousSummary.revenue, previousHasData), completed: metric(currentSummary.visits.length, previousSummary.visits.length, previousHasData), averageSpend: metric(currentSummary.visits.length ? currentSummary.revenue / currentSummary.visits.length : 0, previousSummary.visits.length ? previousSummary.revenue / previousSummary.visits.length : 0, previousHasData), occupancy: metric(occupancy(currentSummary, current), occupancy(previousSummary, previous), previousHasData), newClients: metric(currentSummary.clientMetrics.newClients, previousSummary.clientMetrics.newClients, previousHasData), returningClients: metric(currentSummary.clientMetrics.returningClients, previousSummary.clientMetrics.returningClients, previousHasData), repeatVisitClients: metric(currentSummary.clientMetrics.repeatVisitClients, previousSummary.clientMetrics.repeatVisitClients, previousHasData), repeatVisitRate: metric(currentSummary.clientMetrics.repeatVisitRate, previousSummary.clientMetrics.repeatVisitRate, previousHasData), cancellations: metric(currentSummary.disruptions.cancellations, previousSummary.disruptions.cancellations, previousHasData), cancellationRate: metric(currentSummary.disruptions.cancellationRate, previousSummary.disruptions.cancellationRate, previousHasData), cancellationValue: metric(currentSummary.disruptions.cancellationValue, previousSummary.disruptions.cancellationValue, previousHasData), noShows: metric(currentSummary.disruptions.noShows, previousSummary.disruptions.noShows, previousHasData), noShowRate: metric(currentSummary.disruptions.noShowRate, previousSummary.disruptions.noShowRate, previousHasData), noShowValue: metric(currentSummary.disruptions.noShowValue, previousSummary.disruptions.noShowValue, previousHasData), expectedRevenue: metric(expectedRevenue.amount, 0, previousHasData), outstanding: metric(currentSummary.outstanding, previousSummary.outstanding, previousHasData),
  }, revenueSeries: completeBuckets.map(({ periodStart, revenue }) => ({ periodStart, label: getKpiDateKey(new Date(periodStart), monthly), revenue })), bookingSeries: completeBuckets.map(({ periodStart, completed, cancelled, noShow }) => ({ periodStart, label: getKpiDateKey(new Date(periodStart), monthly), completed, cancelled, noShow })), services, clientMix: { newClients: currentSummary.clientMetrics.newClients, returningClients: currentSummary.clientMetrics.returningClients }, retention: (["8_11", "12_15", "16_plus"] as RetentionBand[]).map((band) => ({ band, label: getRetentionBandLabel(band), count: activeClients.filter((client) => getRetentionBand(client.bookings[0]?.scheduledStartsAt ?? null, retentionReference) === band).length, href: `${baseClientHref}?retention=${band}&retentionAt=${retentionReference.getTime()}` })), retentionReference, acquisition, expectedRevenue: { bookingCount: expectedRevenue.bookingCount, missingPriceCount: expectedRevenue.missingPriceCount, isHistorical: expectedIsHistorical }, unavailable: { hasData: currentSummary.listed.length > 0 } };
}
