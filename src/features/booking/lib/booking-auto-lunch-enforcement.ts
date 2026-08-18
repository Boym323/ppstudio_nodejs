import { AvailabilitySlotStatus, BookingStatus, type Prisma } from "@/generated/prisma/client";

import { loadAutoLunchPolicySnapshot } from "./booking-auto-lunch-policy";
import { getNextCalendarDate, getPragueLocalDate, resolvePragueLocalDateTime } from "./booking-local-time";
import { canPreserveAutoLunch, generateLunchCandidates, shouldApplyAutoLunch } from "./booking-schedule-optimization";

const ACTIVE_BOOKING_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;

/**
 * Ověří lunch invariant nad čerstvým stavem transakce. Při přesunu se původní
 * rezervace vyloučí, aby sama sobě nevytvořila falešnou kolizi.
 */
export async function canPreserveAutoLunchForBooking(
  tx: Prisma.TransactionClient,
  input: { requestedStartsAt: Date; requestedBlockedUntil: Date; excludeBookingId?: string },
) {
  const localDate = getPragueLocalDate(input.requestedStartsAt);
  const nextLocalDate = getNextCalendarDate(localDate);
  const dayStartsAt = resolvePragueLocalDateTime(localDate, "00:00");
  const dayEndsAt = nextLocalDate ? resolvePragueLocalDateTime(nextLocalDate, "00:00") : null;

  if (!dayStartsAt || !dayEndsAt) return false;

  const publishedSlots = await tx.availabilitySlot.findMany({
    where: {
      status: AvailabilitySlotStatus.PUBLISHED,
      startsAt: { lt: dayEndsAt },
      endsAt: { gt: dayStartsAt },
    },
    select: { startsAt: true, endsAt: true },
  });
  const availability = publishedSlots.map((slot) => ({ startsAt: slot.startsAt.getTime(), endsAt: slot.endsAt.getTime() }));
  const policy = await loadAutoLunchPolicySnapshot(tx, [localDate]);
  const active = shouldApplyAutoLunch({
    localDate,
    availability,
    globalAutoLunchEnabled: policy.globalAutoLunchEnabled,
    dayLunchMode: policy.dayLunchModes[localDate] ?? "AUTO",
  });

  if (!active) return true;

  const activeBookings = await tx.booking.findMany({
    where: {
      id: input.excludeBookingId ? { not: input.excludeBookingId } : undefined,
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
      scheduledStartsAt: { lt: dayEndsAt },
      OR: [
        { blockedUntil: { gt: dayStartsAt } },
        { blockedUntil: null, scheduledEndsAt: { gt: dayStartsAt } },
      ],
    },
    select: { scheduledStartsAt: true, scheduledEndsAt: true, blockedUntil: true },
  });

  return canPreserveAutoLunch({
    active,
    availability,
    lunchCandidates: generateLunchCandidates({ localDate, availability }),
    bookedBlocks: activeBookings.map((booking) => ({
      startsAt: booking.scheduledStartsAt.getTime(),
      endsAt: (booking.blockedUntil ?? booking.scheduledEndsAt).getTime(),
    })),
    hypotheticalBlock: {
      startsAt: input.requestedStartsAt.getTime(),
      endsAt: input.requestedBlockedUntil.getTime(),
    },
  }).feasible;
}
