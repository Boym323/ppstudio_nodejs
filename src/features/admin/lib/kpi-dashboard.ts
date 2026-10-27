import "server-only";

import { AvailabilitySlotStatus, BookingPaymentStatus, BookingStatus, VoucherType } from "@/generated/prisma/browser";
import { Prisma } from "@/generated/prisma/client";

import { getAdminSectionPath } from "@/features/admin/lib/admin-paths";
import { getKpiDateKey, getKpiDateRanges, getKpiPercentChange, getKpiPeriodStart, getKpiExpectedRevenueRange, getKpiSeriesPeriodStarts, getPragueDateParts, getPragueMidnight, usesMonthlyKpiBuckets } from "@/features/admin/lib/kpi-date-range";
import { aggregateAcquisition } from "@/features/admin/lib/kpi-acquisition";
import { getKpiClientMetricsFromAggregates, type KpiClientAggregate, type KpiClientMetrics } from "@/features/admin/lib/kpi-client-metrics";
import { calculateKpiOccupancy, mergeKpiTimeIntervals } from "@/features/admin/lib/kpi-occupancy";
import { getKpiMetricPreviousAvailability } from "@/features/admin/lib/kpi-metric-availability";
import { calculateDisruptionMetrics } from "@/features/admin/lib/kpi-disruption-metrics";
import { aggregateServiceMetrics } from "@/features/admin/lib/kpi-service-metrics";
import { getKpiHistoricalPrice } from "@/features/admin/lib/kpi-pricing";
import { getRetentionBandDateBounds, getRetentionBandLabel, type RetentionBand } from "@/features/admin/lib/kpi-retention";
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
    select: { clientId: true, status: true, isManual: true, manualOverride: true, scheduledStartsAt: true, scheduledEndsAt: true, blockedUntil: true, serviceNameSnapshot: true, finalPriceCzk: true, servicePriceFromCzk: true, acquisitionSource: true, acquisitionUtmSource: true, acquisitionUtmMedium: true, acquisitionUtmCampaign: true, slot: { select: { publishedAt: true } } },
  });
}

type KpiPeriodAggregate = {
  completedCount: number;
  revenue: number;
  outstanding: number;
};

type KpiPeriodAggregates = {
  current: KpiPeriodAggregate;
  previous: KpiPeriodAggregate;
};

const emptyKpiPeriodAggregate = (): KpiPeriodAggregate => ({ completedCount: 0, revenue: 0, outstanding: 0 });

async function getKpiPeriodAggregates(previous: KpiDateRange, current: KpiDateRange, end: Date): Promise<KpiPeriodAggregates> {
  const rows = await prisma.$queryRaw<Array<{
    currentCompletedCount: number;
    currentRevenue: number;
    currentOutstanding: number;
    previousCompletedCount: number;
    previousRevenue: number;
    previousOutstanding: number;
  }>>(Prisma.sql`
    WITH booking_prices AS (
      SELECT
        booking."id",
        booking."scheduledStartsAt",
        -- Historické KPI nesmí použít aktuální katalogovou cenu služby.
        GREATEST(COALESCE(booking."finalPriceCzk", booking."servicePriceFromCzk", 0), 0) AS "totalPriceCzk",
        GREATEST(COALESCE(booking."servicePriceFromCzk", 0), 0) AS "servicePriceCzk",
        booking."serviceId"
      FROM "Booking" AS booking
      WHERE booking."scheduledStartsAt" >= ${previous.start}
        AND booking."scheduledStartsAt" < ${end}
        AND booking."status" = ${completed}::"BookingStatus"
    ), booking_payment_totals AS (
      SELECT
        payment."bookingId",
        SUM(GREATEST(payment."amountCzk", 0)) AS "paidCzk"
      FROM "BookingPayment" AS payment
      JOIN booking_prices AS booking ON booking."id" = payment."bookingId"
      WHERE payment."status" <> ${BookingPaymentStatus.VOIDED}::"BookingPaymentStatus"
      GROUP BY payment."bookingId"
    ), voucher_redemption_totals AS (
      SELECT
        redemption."bookingId",
        SUM(GREATEST(redemption."amountCzk", 0)) FILTER (
          WHERE voucher."type" <> ${VoucherType.SERVICE}::"VoucherType"
        ) AS "valueVoucherCzk",
        BOOL_OR(
          voucher."type" = ${VoucherType.SERVICE}::"VoucherType"
          AND redemption."serviceId" = booking."serviceId"
        ) AS "hasMatchingServiceVoucher"
      FROM "VoucherRedemption" AS redemption
      JOIN "Voucher" AS voucher ON voucher."id" = redemption."voucherId"
      JOIN booking_prices AS booking ON booking."id" = redemption."bookingId"
      GROUP BY redemption."bookingId"
    ), booking_financials AS (
      SELECT
        booking.*,
        GREATEST(
          booking."totalPriceCzk"
          - COALESCE(payment."paidCzk", 0)
          - COALESCE(voucher."valueVoucherCzk", 0)
          - CASE WHEN voucher."hasMatchingServiceVoucher" THEN LEAST(booking."totalPriceCzk", booking."servicePriceCzk") ELSE 0 END,
          0
        ) AS "outstandingCzk"
      FROM booking_prices AS booking
      LEFT JOIN booking_payment_totals AS payment ON payment."bookingId" = booking."id"
      LEFT JOIN voucher_redemption_totals AS voucher ON voucher."bookingId" = booking."id"
    )
    SELECT
      COUNT(*) FILTER (
        WHERE "scheduledStartsAt" >= ${current.start}
          AND "scheduledStartsAt" < ${current.end}
      )::int AS "currentCompletedCount",
      COALESCE(SUM("totalPriceCzk") FILTER (
        WHERE "scheduledStartsAt" >= ${current.start}
          AND "scheduledStartsAt" < ${current.end}
      ), 0)::double precision AS "currentRevenue",
      COALESCE(SUM("outstandingCzk") FILTER (
        WHERE "scheduledStartsAt" >= ${current.start}
          AND "scheduledStartsAt" < ${current.end}
      ), 0)::double precision AS "currentOutstanding",
      COUNT(*) FILTER (
        WHERE "scheduledStartsAt" >= ${previous.start}
          AND "scheduledStartsAt" < ${previous.end}
      )::int AS "previousCompletedCount",
      COALESCE(SUM("totalPriceCzk") FILTER (
        WHERE "scheduledStartsAt" >= ${previous.start}
          AND "scheduledStartsAt" < ${previous.end}
      ), 0)::double precision AS "previousRevenue",
      COALESCE(SUM("outstandingCzk") FILTER (
        WHERE "scheduledStartsAt" >= ${previous.start}
          AND "scheduledStartsAt" < ${previous.end}
      ), 0)::double precision AS "previousOutstanding"
    FROM booking_financials
  `);
  const row = rows[0];
  if (!row) return { current: emptyKpiPeriodAggregate(), previous: emptyKpiPeriodAggregate() };
  return {
    current: { completedCount: row.currentCompletedCount, revenue: row.currentRevenue, outstanding: row.currentOutstanding },
    previous: { completedCount: row.previousCompletedCount, revenue: row.previousRevenue, outstanding: row.previousOutstanding },
  };
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
async function getExpectedRevenueAggregate(start: Date, end: Date) {
  const rows = await prisma.$queryRaw<Array<{ amount: number; bookingCount: number; missingPriceCount: number }>>(Prisma.sql`
    SELECT
      COALESCE(SUM(GREATEST(COALESCE("finalPriceCzk", "servicePriceFromCzk", 0), 0)) FILTER (
        WHERE COALESCE("finalPriceCzk", "servicePriceFromCzk") IS NOT NULL
      ), 0)::double precision AS "amount",
      COUNT(*) FILTER (
        WHERE COALESCE("finalPriceCzk", "servicePriceFromCzk") IS NOT NULL
      )::int AS "bookingCount",
      COUNT(*) FILTER (
        WHERE COALESCE("finalPriceCzk", "servicePriceFromCzk") IS NULL
      )::int AS "missingPriceCount"
    FROM "Booking"
    WHERE "status" = ${BookingStatus.CONFIRMED}::"BookingStatus"
      AND "scheduledStartsAt" >= ${start}
      AND "scheduledStartsAt" < ${end}
  `);
  return rows[0] ?? { amount: 0, bookingCount: 0, missingPriceCount: 0 };
}
function price(row: BookingRow) { return getKpiHistoricalPrice(row) ?? 0; }
function summarize(
  rows: BookingRow[],
  range: KpiDateRange,
  clientMetrics: KpiClientMetrics,
  aggregates: KpiPeriodAggregate,
) {
  const listed = rows.filter((row) => inRange(row.scheduledStartsAt, range));
  const visits = listed.filter((row) => row.status === completed);
  const disruptions = calculateDisruptionMetrics(listed.map((row) => ({
    status: row.status,
    slotPublishedAt: row.slot?.publishedAt ?? null,
    finalPriceCzk: row.finalPriceCzk,
    servicePriceFromCzk: row.servicePriceFromCzk,
  })));
  return { listed, visits, completedCount: aggregates.completedCount, revenue: aggregates.revenue, clientMetrics, disruptions, noShowValue: disruptions.noShowValue, outstanding: aggregates.outstanding };
}

async function getKpiClientVisitAggregates(previous: KpiDateRange, current: KpiDateRange) {
  const rows = await prisma.$queryRaw<Array<{
    clientId: string;
    currentVisitCount: number;
    currentFirstVisitAt: Date | null;
    previousVisitCount: number;
    previousFirstVisitAt: Date | null;
    historicalFirstVisitAt: Date | null;
  }>>(Prisma.sql`
    SELECT
      booking."clientId" AS "clientId",
      COUNT(*) FILTER (
        WHERE booking."scheduledStartsAt" >= ${current.start}
          AND booking."scheduledStartsAt" < ${current.end}
      )::int AS "currentVisitCount",
      MIN(booking."scheduledStartsAt") FILTER (
        WHERE booking."scheduledStartsAt" >= ${current.start}
          AND booking."scheduledStartsAt" < ${current.end}
      ) AS "currentFirstVisitAt",
      COUNT(*) FILTER (
        WHERE booking."scheduledStartsAt" >= ${previous.start}
          AND booking."scheduledStartsAt" < ${previous.end}
      )::int AS "previousVisitCount",
      MIN(booking."scheduledStartsAt") FILTER (
        WHERE booking."scheduledStartsAt" >= ${previous.start}
          AND booking."scheduledStartsAt" < ${previous.end}
      ) AS "previousFirstVisitAt",
      (
        SELECT MIN(history."scheduledStartsAt")
        FROM "Booking" AS history
        WHERE history."clientId" = booking."clientId"
          AND history."status" = ${completed}::"BookingStatus"
          AND history."scheduledStartsAt" < ${previous.start}
      ) AS "historicalFirstVisitAt"
    FROM "Booking" AS booking
    WHERE booking."status" = ${completed}::"BookingStatus"
      AND booking."scheduledStartsAt" >= ${previous.start}
      AND booking."scheduledStartsAt" < ${current.end}
    GROUP BY booking."clientId"
  `);
  const currentAggregates = rows.flatMap((row): KpiClientAggregate[] => row.currentVisitCount > 0
    ? [{ clientId: row.clientId, visitCount: row.currentVisitCount, firstVisitAt: row.currentFirstVisitAt }]
    : []);
  const previousAggregates = rows.flatMap((row): KpiClientAggregate[] => row.previousVisitCount > 0
    ? [{ clientId: row.clientId, visitCount: row.previousVisitCount, firstVisitAt: row.previousFirstVisitAt }]
    : []);
  const historicalAggregates = rows.flatMap((row): KpiClientAggregate[] => row.historicalFirstVisitAt
    ? [{ clientId: row.clientId, visitCount: 1, firstVisitAt: row.historicalFirstVisitAt }]
    : []);
  return {
    current: currentAggregates,
    previous: previousAggregates,
    historical: historicalAggregates,
  };
}

type KpiRetentionAggregates = Record<RetentionBand, number>;

async function getKpiRetentionAggregates(reference: Date): Promise<KpiRetentionAggregates> {
  const bounds = (["8_11", "12_15", "16_plus"] as RetentionBand[]).map((band) => ({ band, ...getRetentionBandDateBounds(band, reference) }));
  const [eightToEleven, twelveToFifteen, sixteenPlus] = bounds;
  const rows = await prisma.$queryRaw<Array<KpiRetentionAggregates>>(Prisma.sql`
    WITH latest_visits AS (
      SELECT DISTINCT ON (booking."clientId") booking."scheduledStartsAt" AS "lastVisitAt"
      FROM "Booking" AS booking
      JOIN "Client" AS client ON client."id" = booking."clientId"
      WHERE client."isActive" = true
        AND booking."status" = ${completed}::"BookingStatus"
        AND booking."scheduledStartsAt" < ${reference}
      ORDER BY booking."clientId", booking."scheduledStartsAt" DESC
    )
    SELECT
      COUNT(*) FILTER (
        WHERE "lastVisitAt" >= ${eightToEleven.start}
          AND "lastVisitAt" < ${eightToEleven.end}
      )::int AS "8_11",
      COUNT(*) FILTER (
        WHERE "lastVisitAt" >= ${twelveToFifteen.start}
          AND "lastVisitAt" < ${twelveToFifteen.end}
      )::int AS "12_15",
      COUNT(*) FILTER (
        WHERE "lastVisitAt" < ${sixteenPlus.end}
      )::int AS "16_plus"
    FROM latest_visits
  `);
  return rows[0] ?? { "8_11": 0, "12_15": 0, "16_plus": 0 };
}

export async function getKpiDashboardData(area: "owner" | "salon", searchParams?: Record<string, string | string[] | undefined>): Promise<KpiDashboardData> {
  const { current, previous } = getKpiDateRanges(searchParams);
  const now = new Date();
  const nowParts = getPragueDateParts(now);
  const monthRange: KpiDateRange = { start: getPragueMidnight(nowParts.year, nowParts.month, 1), end: getPragueMidnight(nowParts.year, nowParts.month + 1, 1), label: "Tento měsíc", period: "this_month" };
  const dataEnd = current.period === "this_month" ? monthRange.end : current.end;
  const retentionReference = new Date(Math.min(now.getTime(), current.end.getTime() - 1));
  const expectedRange = getKpiExpectedRevenueRange(current, now);
  const expectedIsHistorical = current.end <= now;
  const [periodRows, clientVisitAggregates, slots, retentionAggregates, periodAggregates, expectedRevenue] = await Promise.all([
    getBookings(previous.start, dataEnd),
    getKpiClientVisitAggregates(previous, current),
    prisma.availabilitySlot.findMany({ where: { status: { in: [AvailabilitySlotStatus.PUBLISHED, AvailabilitySlotStatus.ARCHIVED] }, publishedAt: { not: null }, startsAt: { lt: dataEnd }, endsAt: { gt: previous.start } }, select: { startsAt: true, endsAt: true } }),
    getKpiRetentionAggregates(retentionReference),
    getKpiPeriodAggregates(previous, current, dataEnd),
    expectedRange ? getExpectedRevenueAggregate(expectedRange.start, expectedRange.end) : Promise.resolve({ amount: 0, bookingCount: 0, missingPriceCount: 0 }),
  ]);
  const extendedRows = periodRows as BookingRow[];
  const currentClientMetrics = getKpiClientMetricsFromAggregates(clientVisitAggregates.current, clientVisitAggregates.previous, clientVisitAggregates.historical, current);
  const previousClientMetrics = getKpiClientMetricsFromAggregates(clientVisitAggregates.previous, [], clientVisitAggregates.historical, previous);
  const currentSummary = summarize(extendedRows, current, currentClientMetrics, periodAggregates.current);
  const previousSummary = summarize(extendedRows, previous, previousClientMetrics, periodAggregates.previous);
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
  const monthlyRange = current.period === "this_month" || current.period === "last_month" || current.period === "next_month"
    ? current.period === "this_month" ? monthRange : current
    : null;
  const monthlyOccupancy = monthlyRange ? await (async () => {
    const monthlySlots = mergeKpiTimeIntervals(slots, monthlyRange);
    const monthlyBookingRows = extendedRows
      .filter((row) => inRange(row.scheduledStartsAt, monthlyRange) && new Set<BookingStatus>([BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW]).has(row.status))
    const monthlyBookings = monthlyBookingRows.map((row) => ({ startsAt: row.scheduledStartsAt, endsAt: row.blockedUntil ?? row.scheduledEndsAt }));
    const monthlyLunch = getOccupancyLunchMinutes(monthlySlots, monthlyBookingRows, await loadAutoLunchPolicySnapshot(prisma, monthlySlots.map((slot) => getPragueLocalDate(slot.startsAt))));
    return calculateKpiOccupancy({ publishedAvailability: monthlySlots, manualCompletedWork: [], completedWork: monthlyBookings, range: monthlyRange, lunchMinutes: monthlyLunch });
  })() : null;
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
    completedCount: previousSummary.completedCount,
    completedClientCount: new Set(previousSummary.visits.flatMap((row) => row.clientId ? [row.clientId] : [])).size,
    physicalAvailabilityMinutes: previousOccupancy.bookableMinutes,
    relevantDisruptionCount: previousSummary.disruptions.relevantCount,
  });
  return { range: current, previousRange: previous, calculatedAt: now,
    occupancy: { reservedMinutes: currentOccupancy.reservedMinutes, bookableMinutes: currentOccupancy.bookableMinutes },
    monthlyOccupancy: monthlyOccupancy ? { reservedMinutes: monthlyOccupancy.reservedMinutes, bookableMinutes: monthlyOccupancy.bookableMinutes, percent: monthlyOccupancy.percent } : null,
    disruptionBookingCount: currentSummary.disruptions.relevantCount,
    metrics: {
    revenue: metric(currentSummary.revenue, previousSummary.revenue, previousAvailability.periodTotals), completed: metric(currentSummary.completedCount, previousSummary.completedCount, previousAvailability.periodTotals), averageSpend: metric(currentSummary.completedCount ? currentSummary.revenue / currentSummary.completedCount : 0, previousSummary.completedCount ? previousSummary.revenue / previousSummary.completedCount : 0, previousAvailability.averageSpend), occupancy: metric(currentOccupancy.percent, previousOccupancy.percent, previousAvailability.occupancy), newClients: metric(currentSummary.clientMetrics.newClients, previousSummary.clientMetrics.newClients, previousAvailability.periodTotals), returningClients: metric(currentSummary.clientMetrics.returningClients, previousSummary.clientMetrics.returningClients, previousAvailability.periodTotals), repeatVisitClients: metric(currentSummary.clientMetrics.repeatVisitClients, previousSummary.clientMetrics.repeatVisitClients, previousAvailability.periodTotals), repeatVisitRate: metric(currentSummary.clientMetrics.repeatVisitRate, previousSummary.clientMetrics.repeatVisitRate, previousAvailability.repeatVisitRate), cancellations: metric(currentSummary.disruptions.cancellations, previousSummary.disruptions.cancellations, previousAvailability.periodTotals), cancellationRate: metric(currentSummary.disruptions.cancellationRate, previousSummary.disruptions.cancellationRate, previousAvailability.disruptionRates), cancellationValue: metric(currentSummary.disruptions.cancellationValue, previousSummary.disruptions.cancellationValue, previousAvailability.periodTotals), noShows: metric(currentSummary.disruptions.noShows, previousSummary.disruptions.noShows, previousAvailability.periodTotals), noShowRate: metric(currentSummary.disruptions.noShowRate, previousSummary.disruptions.noShowRate, previousAvailability.disruptionRates), noShowValue: metric(currentSummary.disruptions.noShowValue, previousSummary.noShowValue, previousAvailability.periodTotals), expectedRevenue: metric(expectedRevenue.amount, 0, previousAvailability.expectedRevenue), outstanding: metric(currentSummary.outstanding, previousSummary.outstanding, previousAvailability.outstanding),
  }, revenueSeries: completeBuckets.map(({ periodStart, revenue }) => ({ periodStart, label: getKpiDateKey(new Date(periodStart), monthly), revenue })), bookingSeries: completeBuckets.map(({ periodStart, completed, cancelled, noShow }) => ({ periodStart, label: getKpiDateKey(new Date(periodStart), monthly), completed, cancelled, noShow })), services, clientMix: { newClients: currentSummary.clientMetrics.newClients, returningClients: currentSummary.clientMetrics.returningClients }, retention: (["8_11", "12_15", "16_plus"] as RetentionBand[]).map((band) => ({ band, label: getRetentionBandLabel(band), count: retentionAggregates[band], href: `${baseClientHref}?retention=${band}&retentionAt=${retentionReference.getTime()}` })), retentionReference, acquisition, expectedRevenue: { bookingCount: expectedRevenue.bookingCount, missingPriceCount: expectedRevenue.missingPriceCount, isHistorical: expectedIsHistorical }, unavailable: { hasData: currentSummary.listed.length > 0 } };
}
