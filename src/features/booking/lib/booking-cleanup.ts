export const MAX_SERVICE_CLEANUP_MINUTES = 480;

export function roundUpToQuarterHour(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 0;
  }

  return Math.ceil(minutes / 15) * 15;
}

export function resolveBookingTimingSnapshot(input: {
  startsAt: Date;
  serviceDurationMinutes: number;
  cleanupMinutes?: number | null;
  cleanupBlockMinutes?: number | null;
}) {
  const serviceDurationMinutes = Math.max(0, Math.trunc(input.serviceDurationMinutes));
  const cleanupMinutes = Math.max(0, Math.trunc(input.cleanupMinutes ?? 0));
  const cleanupBlockMinutes = Math.max(
    0,
    Math.trunc(input.cleanupBlockMinutes ?? roundUpToQuarterHour(cleanupMinutes)),
  );

  const serviceEnd = new Date(input.startsAt.getTime() + serviceDurationMinutes * 60 * 1000);
  const blockedUntil = new Date(serviceEnd.getTime() + cleanupBlockMinutes * 60 * 1000);

  return {
    serviceDurationMinutes,
    cleanupMinutes,
    cleanupBlockMinutes,
    serviceEnd,
    blockedUntil,
  };
}
