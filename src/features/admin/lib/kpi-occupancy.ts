import { type KpiDateRange } from "@/features/admin/types/kpi-dashboard";

const minute = 60_000;

export type KpiTimeInterval = { startsAt: Date; endsAt: Date };

export function mergeKpiTimeIntervals(intervals: KpiTimeInterval[], range: Pick<KpiDateRange, "start" | "end">) {
  const clipped = intervals.flatMap((interval) => {
    const startsAt = Math.max(interval.startsAt.getTime(), range.start.getTime());
    const endsAt = Math.min(interval.endsAt.getTime(), range.end.getTime());
    return endsAt > startsAt ? [{ startsAt, endsAt }] : [];
  }).sort((left, right) => left.startsAt - right.startsAt || left.endsAt - right.endsAt);

  const merged: Array<{ startsAt: number; endsAt: number }> = [];
  for (const interval of clipped) {
    const previous = merged.at(-1);
    if (previous && interval.startsAt <= previous.endsAt) {
      previous.endsAt = Math.max(previous.endsAt, interval.endsAt);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged.map((interval) => ({ startsAt: new Date(interval.startsAt), endsAt: new Date(interval.endsAt) }));
}

export function getKpiIntervalUnionMinutes(intervals: KpiTimeInterval[], range: Pick<KpiDateRange, "start" | "end">) {
  return mergeKpiTimeIntervals(intervals, range).reduce(
    (total, interval) => total + (interval.endsAt.getTime() - interval.startsAt.getTime()) / minute,
    0,
  );
}

export function calculateKpiOccupancy(input: {
  publishedAvailability: KpiTimeInterval[];
  manualCompletedWork: KpiTimeInterval[];
  completedWork: KpiTimeInterval[];
  range: Pick<KpiDateRange, "start" | "end">;
  lunchMinutes?: number;
}) {
  const availableMinutes = getKpiIntervalUnionMinutes(
    [...input.publishedAvailability, ...input.manualCompletedWork],
    input.range,
  );
  const bookableMinutes = Math.max(0, availableMinutes - (input.lunchMinutes ?? 0));
  const reservedMinutes = input.completedWork.reduce((total, interval) => {
    const startsAt = Math.max(interval.startsAt.getTime(), input.range.start.getTime());
    const endsAt = Math.min(interval.endsAt.getTime(), input.range.end.getTime());
    return total + Math.max(0, endsAt - startsAt) / minute;
  }, 0);
  const rawPercent = bookableMinutes ? (reservedMinutes / bookableMinutes) * 100 : 0;
  return {
    availableMinutes,
    bookableMinutes,
    reservedMinutes,
    rawPercent,
    percent: Math.min(100, rawPercent),
  };
}
