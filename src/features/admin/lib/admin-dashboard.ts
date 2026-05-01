import { AvailabilitySlotStatus, BookingStatus, EmailLogStatus } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  getAdminBookingActionOptions,
  getAdminBookingHref,
  getBookingStatusLabel,
} from "@/features/admin/lib/admin-booking";
import { prisma } from "@/lib/prisma";

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];
const TIMELINE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
];
const ACTIVE_SLOT_STATUSES: AvailabilitySlotStatus[] = [
  AvailabilitySlotStatus.DRAFT,
  AvailabilitySlotStatus.PUBLISHED,
];

const dayLabelFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const timeFormatter = new Intl.DateTimeFormat("cs-CZ", {
  hour: "2-digit",
  minute: "2-digit",
});

type DashboardAlertTone = "warning" | "problem" | "success";

function formatCountLabel(count: number, singular: string, pluralFew: string, pluralMany: string) {
  const mod100 = count % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return pluralMany;
  }

  const mod10 = count % 10;

  if (mod10 === 1) {
    return singular;
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return pluralFew;
  }

  return pluralMany;
}

function formatRelativeTime(target: Date, now: Date) {
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "právě teď";
  }

  const totalMinutes = Math.round(diffMs / 60000);

  if (totalMinutes < 60) {
    return `za ${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `za ${hours} h`;
  }

  return `za ${hours} h ${minutes} min`;
}

export type DashboardTimelineItem =
  | {
      id: string;
      kind: "booking";
      sortTime: number;
      timeLabel: string;
      title: string;
      subtitle: string;
      badge: "REZERVACE";
      href: string;
      bookingId: string;
      bookingStatus: BookingStatus;
      bookingStatusLabel: string;
      availableActions: Array<{
        value: string;
        label: string;
      }>;
    }
  | {
      id: string;
      kind: "free";
      sortTime: number;
      timeLabel: string;
      title: string;
      subtitle: string;
      badge: "VOLNE";
      href: string;
      createHref: string;
      editHref: string;
    };

type DashboardTaskTone = "warning" | "success" | "neutral";

type DashboardTodayTask = {
  id: string;
  label: string;
  tone: DashboardTaskTone;
};

export type DashboardTodayPlanItem = {
  id: string;
  timeLabel: string;
  serviceName: string;
  clientName: string;
  statusLabel: string;
  href: string;
  isCurrent: boolean;
  isCompleted: boolean;
};

export type DashboardUpcomingSlot = {
  id: string;
  dayLabel: string;
  timeLabel: string;
  metaLabel: string;
  href: string;
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDayLabel(date: Date) {
  return capitalize(dayLabelFormatter.format(date));
}

function getSlotEditHref(area: AdminArea, slotId: string) {
  return area === "owner"
    ? `/admin/volne-terminy/${slotId}/upravit`
    : `/admin/provoz/volne-terminy/${slotId}/upravit`;
}

function getPlannerHref(area: AdminArea) {
  return area === "owner" ? "/admin/volne-terminy" : "/admin/provoz/volne-terminy";
}

function getBookingsHref(area: AdminArea) {
  return area === "owner" ? "/admin/rezervace" : "/admin/provoz/rezervace";
}

function getClientsHref(area: AdminArea) {
  return area === "owner" ? "/admin/klienti" : "/admin/provoz/klienti";
}

function getTodayBounds(now: Date) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const dayAfterTomorrowStart = new Date(tomorrowStart);
  dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 1);

  return {
    todayStart,
    tomorrowStart,
    dayAfterTomorrowStart,
  };
}

function getWeekBounds(now: Date) {
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return { weekStart, weekEnd };
}

export function buildTimelineItems(
  area: AdminArea,
  now: Date,
  slots: Array<{
    id: string;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    bookings: Array<{
      id: string;
      scheduledStartsAt: Date;
      scheduledEndsAt: Date;
      status: BookingStatus;
      serviceNameSnapshot: string;
      clientNameSnapshot: string;
    }>;
  }>,
) {
  const items: DashboardTimelineItem[] = [];

  for (const slot of slots) {
    const bookings = [...slot.bookings].sort(
      (left, right) => left.scheduledStartsAt.getTime() - right.scheduledStartsAt.getTime(),
    );
    let cursor = slot.startsAt;

    const pushFreeWindow = (startsAt: Date, endsAt: Date, idSuffix: string) => {
      const effectiveStartsAt = startsAt.getTime() < now.getTime() ? now : startsAt;

      if (effectiveStartsAt.getTime() >= endsAt.getTime()) {
        return;
      }

      items.push({
        id: `${slot.id}-free-${idSuffix}`,
        kind: "free",
        sortTime: effectiveStartsAt.getTime(),
        timeLabel: `${timeFormatter.format(effectiveStartsAt)} - ${timeFormatter.format(endsAt)}`,
        title: "Volné okno",
        subtitle:
          endsAt.getTime() > now.getTime()
            ? `Kapacita ${slot.capacity} • připravené pro další rezervaci`
            : `Kapacita ${slot.capacity} • historické volno`,
        badge: "VOLNE",
        href: getSlotEditHref(area, slot.id),
        createHref: getBookingsHref(area),
        editHref: getSlotEditHref(area, slot.id),
      });
    };

    for (const booking of bookings) {
      if (booking.scheduledStartsAt.getTime() > cursor.getTime()) {
        pushFreeWindow(cursor, booking.scheduledStartsAt, cursor.toISOString());
      }

      items.push({
        id: booking.id,
        kind: "booking",
        sortTime: booking.scheduledStartsAt.getTime(),
        timeLabel: `${timeFormatter.format(booking.scheduledStartsAt)} - ${timeFormatter.format(booking.scheduledEndsAt)}`,
        title: booking.serviceNameSnapshot,
        subtitle: booking.clientNameSnapshot,
        badge: "REZERVACE",
        href: getAdminBookingHref(area, booking.id),
        bookingId: booking.id,
        bookingStatus: booking.status,
        bookingStatusLabel: getBookingStatusLabel(booking.status),
        availableActions: getAdminBookingActionOptions(booking.status, {
          scheduledEndsAt: booking.scheduledEndsAt,
        }),
      });

      if (booking.scheduledEndsAt.getTime() > cursor.getTime()) {
        cursor = booking.scheduledEndsAt;
      }
    }

    if (cursor.getTime() < slot.endsAt.getTime()) {
      pushFreeWindow(cursor, slot.endsAt, slot.endsAt.toISOString());
    }
  }

  return items.sort((left, right) => left.sortTime - right.sortTime);
}

function getWeekOccupancy(
  slots: Array<{
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    bookings: Array<{
      scheduledStartsAt: Date;
      scheduledEndsAt: Date;
    }>;
  }>,
) {
  const availableMinutes = slots.reduce((total, slot) => {
    const slotMinutes = (slot.endsAt.getTime() - slot.startsAt.getTime()) / 60000;
    return total + slotMinutes * Math.max(slot.capacity, 1);
  }, 0);

  const bookedMinutes = slots.reduce((total, slot) => {
    return (
      total +
      slot.bookings.reduce((slotTotal, booking) => {
        return (
          slotTotal + (booking.scheduledEndsAt.getTime() - booking.scheduledStartsAt.getTime()) / 60000
        );
      }, 0)
    );
  }, 0);

  if (availableMinutes === 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100)));
}

export type AdminDashboardData = {
  area: AdminArea;
  todayLabel: string;
  todayBookingsCount: number;
  todayBookingsLabel: string;
  nextReservationSummary: string;
  currentReservationSummary: string | null;
  todayStatusLabel: string;
  nextClient: {
    timeLabel: string;
    timeRangeLabel: string;
    relativeLabel: string;
    serviceName: string;
    clientName: string;
    detailHref: string;
    editHref: string;
  } | null;
  todayTasks: DashboardTodayTask[];
  alerts: Array<{
    id: string;
    tone: DashboardAlertTone;
    text: string;
    href: string;
    actionLabel: string;
    emphasis: "primary" | "secondary" | "ok";
  }>;
  todayPlanItems: DashboardTodayPlanItem[];
  timelineItems: DashboardTimelineItem[];
  timelineFooterHref: string;
  createBookingHref: string;
  addSlotHref: string;
  kpis: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  weekSummary: {
    occupancyLabel: string;
    freeSlotsLabel: string;
    bookingsLabel: string;
  };
  pendingConfirmations: {
    count: number;
    href: string;
  };
  hasPublishedSlotsTodayOrTomorrow: boolean;
  hasFreeWindowsToday: boolean;
  upcomingSlots: DashboardUpcomingSlot[];
  upcomingSlotsFooterHref: string;
  quickActions: Array<{
    id: string;
    label: string;
    description: string;
    href: string;
    icon: "plus" | "calendar" | "booking" | "clients";
  }>;
};

export async function getAdminDashboardData(area: AdminArea): Promise<AdminDashboardData> {
  const now = new Date();
  const { todayStart, tomorrowStart, dayAfterTomorrowStart } = getTodayBounds(now);
  const { weekStart, weekEnd } = getWeekBounds(now);

  const bookingsHref = getBookingsHref(area);
  const plannerHref = getPlannerHref(area);
  const clientsHref = getClientsHref(area);

  const [
    todayBookings,
    todaySlots,
    pendingBookings,
    failedEmails,
    weekSlots,
    nearbyPublishedSlots,
  ] = await Promise.all([
    prisma.booking.findMany({
      where: {
        scheduledStartsAt: { gte: todayStart, lt: tomorrowStart },
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
      orderBy: { scheduledStartsAt: "asc" },
      select: {
        id: true,
        scheduledStartsAt: true,
        scheduledEndsAt: true,
        serviceNameSnapshot: true,
        clientNameSnapshot: true,
      },
    }),
    prisma.availabilitySlot.findMany({
      where: {
        startsAt: { gte: todayStart, lt: tomorrowStart },
        status: { in: ACTIVE_SLOT_STATUSES },
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        bookings: {
          where: { status: { in: TIMELINE_BOOKING_STATUSES } },
          orderBy: { scheduledStartsAt: "asc" },
          select: {
            id: true,
            scheduledStartsAt: true,
            scheduledEndsAt: true,
            status: true,
            serviceNameSnapshot: true,
            clientNameSnapshot: true,
          },
        },
      },
    }),
    prisma.booking.count({
      where: {
        status: BookingStatus.PENDING,
      },
    }),
    prisma.emailLog.count({ where: { status: EmailLogStatus.FAILED } }),
    prisma.availabilitySlot.findMany({
      where: {
        startsAt: { gte: weekStart, lt: weekEnd },
        status: { in: ACTIVE_SLOT_STATUSES },
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        bookings: {
          where: { status: { in: ACTIVE_BOOKING_STATUSES } },
          select: {
            id: true,
            scheduledStartsAt: true,
            scheduledEndsAt: true,
          },
        },
      },
    }),
    prisma.availabilitySlot.findMany({
      where: {
        startsAt: { gte: now, lt: weekEnd },
        status: AvailabilitySlotStatus.PUBLISHED,
      },
      orderBy: { startsAt: "asc" },
      take: 8,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        bookings: {
          where: { status: { in: ACTIVE_BOOKING_STATUSES } },
          select: { id: true },
        },
      },
    }),
  ]);

  const safeText = (value: string, fallback: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  };

  const currentTodayBooking =
    todayBookings.find(
      (booking) =>
        booking.scheduledStartsAt.getTime() <= now.getTime() &&
        booking.scheduledEndsAt.getTime() > now.getTime(),
    ) ?? null;
  const nextTodayBooking =
    todayBookings.find((booking) => booking.scheduledStartsAt.getTime() >= now.getTime()) ?? null;
  const timelineItems = buildTimelineItems(area, now, todaySlots);
  const todayPlanItems: DashboardTodayPlanItem[] = timelineItems
    .filter((item): item is Extract<DashboardTimelineItem, { kind: "booking" }> => item.kind === "booking")
    .map((item) => ({
      id: item.id,
      timeLabel: item.timeLabel,
      serviceName: safeText(item.title, "Služba není uvedená"),
      clientName: safeText(item.subtitle, "Klientka není uvedená"),
      statusLabel: item.bookingStatusLabel,
      href: item.href,
      isCurrent: item.id === currentTodayBooking?.id,
      isCompleted: item.bookingStatus === BookingStatus.COMPLETED,
    }));
  const freeWindowCount = timelineItems.filter((item) => item.badge === "VOLNE").length;
  const weekOccupancy = getWeekOccupancy(weekSlots);
  const weekFreeSlots = weekSlots.filter((slot) => slot.bookings.length < slot.capacity).length;
  const weekBookingsCount = weekSlots.reduce((total, slot) => total + slot.bookings.length, 0);
  const upcomingFreeSlots = nearbyPublishedSlots.filter((slot) => slot.bookings.length < slot.capacity);
  const hasPublishedSlotsTodayOrTomorrow = upcomingFreeSlots.some(
    (slot) => slot.startsAt >= todayStart && slot.startsAt < dayAfterTomorrowStart,
  );
  const hasFreeWindowsToday = upcomingFreeSlots.some(
    (slot) => slot.startsAt >= todayStart && slot.startsAt < tomorrowStart,
  );

  const alerts: AdminDashboardData["alerts"] = [];

  if (pendingBookings > 0) {
    alerts.push({
      id: "pending-bookings",
      tone: "warning",
      text: `${pendingBookings} ${formatCountLabel(
        pendingBookings,
        "rezervace čeká na potvrzení",
        "rezervace čekají na potvrzení",
        "rezervací čeká na potvrzení",
      )}.`,
      href: bookingsHref,
      actionLabel: "Otevřít rezervace",
      emphasis: "primary",
    });
  }

  if (failedEmails > 0) {
    alerts.push({
      id: "email-failures",
      tone: "problem",
      text: `${failedEmails} ${formatCountLabel(
        failedEmails,
        "e-mail se nepodařilo odeslat",
        "e-maily se nepodařilo odeslat",
        "e-mailů se nepodařilo odeslat",
      )}.`,
      href: area === "owner" ? "/admin/email-logy" : bookingsHref,
      actionLabel: area === "owner" ? "Otevřít e-mail logy" : "Otevřít rezervace",
      emphasis: "secondary",
    });
  }

  if (!hasPublishedSlotsTodayOrTomorrow) {
    alerts.push({
      id: "nearby-slots",
      tone: "problem",
      text: "Na dnes a zítra není publikovaný žádný volný termín.",
      href: plannerHref,
      actionLabel: "Upravit dostupnost",
      emphasis: "secondary",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all-good",
      tone: "success",
      text: "Vše je připravené. Žádná položka teď nevyžaduje pozornost.",
      href: bookingsHref,
      actionLabel: "Otevřít rezervace",
      emphasis: "ok",
    });
  }

  const todayTasks: DashboardTodayTask[] = [
    {
      id: "pending",
      label:
        pendingBookings > 0
          ? `${pendingBookings} ${formatCountLabel(
              pendingBookings,
              "čeká na potvrzení",
              "čekají na potvrzení",
              "čeká na potvrzení",
            )}`
          : "Všechny rezervace jsou zpracované",
      tone: pendingBookings > 0 ? "warning" : "success",
    },
    {
      id: "next-client",
      label: nextTodayBooking
        ? `Další klientka ${formatRelativeTime(nextTodayBooking.scheduledStartsAt, now)}`
        : todayBookings.length > 0
          ? "Další klientka dnes už není"
          : "Dnes zatím bez klientky",
      tone: nextTodayBooking ? "warning" : "neutral",
    },
    {
      id: "free-windows",
      label: `${freeWindowCount} ${formatCountLabel(
        freeWindowCount,
        "volné okno dnes",
        "volná okna dnes",
        "volných oken dnes",
      )}`,
      tone: freeWindowCount > 0 ? "neutral" : "success",
    },
    {
      id: "failed-emails",
      label: `${failedEmails} ${formatCountLabel(
        failedEmails,
        "chybný e-mail",
        "chybné e-maily",
        "chybných e-mailů",
      )}`,
      tone: failedEmails > 0 ? "warning" : "success",
    },
  ];

  return {
    area,
    todayLabel: `Dnes • ${formatDayLabel(now)}`,
    todayBookingsCount: todayBookings.length,
    todayBookingsLabel: formatCountLabel(
      todayBookings.length,
      "rezervace",
      "rezervace",
      "rezervací",
    ),
    currentReservationSummary: currentTodayBooking
      ? `Právě probíhá: ${timeFormatter.format(
          currentTodayBooking.scheduledStartsAt,
        )}–${timeFormatter.format(currentTodayBooking.scheduledEndsAt)} ${safeText(
          currentTodayBooking.serviceNameSnapshot,
          "Služba není uvedená",
        )}.`
      : null,
    nextReservationSummary: nextTodayBooking
      ? `Další rezervace: ${timeFormatter.format(nextTodayBooking.scheduledStartsAt)}–${timeFormatter.format(
          nextTodayBooking.scheduledEndsAt,
        )} ${safeText(nextTodayBooking.serviceNameSnapshot, "Služba není uvedená")}.`
      : todayBookings.length > 0
        ? "Další klientka dnes už není."
        : "Dnes zatím není naplánovaná žádná rezervace.",
    todayStatusLabel:
      todayBookings.length > 0
        ? todayBookings.length === 1
          ? "Dnes je naplánovaná 1 aktivní rezervace."
          : `Dnes jsou naplánované ${todayBookings.length} ${formatCountLabel(
              todayBookings.length,
              "aktivní rezervace",
              "aktivní rezervace",
              "aktivních rezervací",
            )}.`
        : "Dnes zatím není naplánovaná žádná rezervace.",
    nextClient: nextTodayBooking
      ? {
          timeLabel: timeFormatter.format(nextTodayBooking.scheduledStartsAt),
          timeRangeLabel: `${timeFormatter.format(nextTodayBooking.scheduledStartsAt)}–${timeFormatter.format(
            nextTodayBooking.scheduledEndsAt,
          )}`,
          relativeLabel: formatRelativeTime(nextTodayBooking.scheduledStartsAt, now),
          serviceName: safeText(nextTodayBooking.serviceNameSnapshot, "Služba není uvedená"),
          clientName: safeText(nextTodayBooking.clientNameSnapshot, "Klientka není uvedená"),
          detailHref: getAdminBookingHref(area, nextTodayBooking.id),
          editHref: getAdminBookingHref(area, nextTodayBooking.id),
        }
      : null,
    todayTasks,
    alerts,
    todayPlanItems,
    timelineItems,
    timelineFooterHref: plannerHref,
    createBookingHref: bookingsHref,
    addSlotHref: `${plannerHref}/novy`,
    kpis: [
      {
        label: "Dnes rezervace",
        value: String(todayBookings.length),
        detail: "aktivní dnešní rezervace",
      },
      {
        label: "Volná okna dnes",
        value: String(freeWindowCount),
        detail: "v dnešním rozvrhu",
      },
      {
        label: "Týdenní obsazenost",
        value: `${weekOccupancy} %`,
        detail: "podle minut a kapacity",
      },
      {
        label: "Volné sloty tento týden",
        value: String(weekFreeSlots),
        detail: "sloty se zbývající kapacitou",
      },
    ],
    weekSummary: {
      occupancyLabel: `${weekOccupancy} %`,
      freeSlotsLabel: `${weekFreeSlots} ${formatCountLabel(
        weekFreeSlots,
        "volný slot",
        "volné sloty",
        "volných slotů",
      )}`,
      bookingsLabel: `${weekBookingsCount} ${formatCountLabel(
        weekBookingsCount,
        "rezervace",
        "rezervace",
        "rezervací",
      )}`,
    },
    pendingConfirmations: {
      count: pendingBookings,
      href: bookingsHref,
    },
    hasPublishedSlotsTodayOrTomorrow,
    hasFreeWindowsToday,
    upcomingSlots: upcomingFreeSlots.map((slot) => {
      const prefix =
        slot.startsAt >= todayStart && slot.startsAt < tomorrowStart
          ? "Dnes"
          : slot.startsAt >= tomorrowStart && slot.startsAt < dayAfterTomorrowStart
            ? "Zítra"
            : formatDayLabel(slot.startsAt);
      const remainingCapacity = Math.max(slot.capacity - slot.bookings.length, 0);

      return {
        id: slot.id,
        dayLabel: prefix,
        timeLabel: timeFormatter.format(slot.startsAt),
        metaLabel: `volno • kapacita ${remainingCapacity}`,
        href: getSlotEditHref(area, slot.id),
      };
    }),
    upcomingSlotsFooterHref: plannerHref,
    quickActions: [
      {
        id: "create-booking",
        label: "Vytvořit rezervaci",
        description: "Nový termín pro klientku",
        href: bookingsHref,
        icon: "booking",
      },
      {
        id: "bookings",
        label: "Otevřít rezervace",
        description: "Seznam a potvrzení",
        href: bookingsHref,
        icon: "calendar",
      },
      {
        id: "availability",
        label: "Upravit dostupnost",
        description: "Volné termíny",
        href: plannerHref,
        icon: "calendar",
      },
      {
        id: "clients",
        label: "Klienti",
        description: "Kontakty a historie",
        href: clientsHref,
        icon: "clients",
      },
    ],
  };
}
