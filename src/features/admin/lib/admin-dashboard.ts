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

function formatMinutesUntil(target: Date, now: Date) {
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return "další rezervace právě začíná";
  }

  const totalMinutes = Math.round(diffMs / 60000);

  if (totalMinutes < 60) {
    return `další rezervace za ${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `další rezervace za ${hours} h`;
  }

  return `další rezervace za ${hours} h ${minutes} min`;
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

function buildTimelineItems(
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

    for (const booking of bookings) {
      if (booking.scheduledStartsAt.getTime() > cursor.getTime()) {
        items.push({
          id: `${slot.id}-free-${cursor.toISOString()}`,
          kind: "free",
          sortTime: cursor.getTime(),
          timeLabel: `${timeFormatter.format(cursor)} - ${timeFormatter.format(booking.scheduledStartsAt)}`,
          title: "Volné okno",
          subtitle:
            booking.scheduledStartsAt.getTime() > now.getTime()
              ? `${formatRelativeTime(booking.scheduledStartsAt, now)} do další rezervace`
              : `Kapacita ${slot.capacity} • připravené pro další rezervaci`,
          badge: "VOLNE",
          href: getSlotEditHref(area, slot.id),
          createHref: getBookingsHref(area),
          editHref: getSlotEditHref(area, slot.id),
        });
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
        availableActions: getAdminBookingActionOptions(booking.status),
      });

      if (booking.scheduledEndsAt.getTime() > cursor.getTime()) {
        cursor = booking.scheduledEndsAt;
      }
    }

    if (cursor.getTime() < slot.endsAt.getTime()) {
      items.push({
        id: `${slot.id}-free-${slot.endsAt.toISOString()}`,
        kind: "free",
        sortTime: cursor.getTime(),
        timeLabel: `${timeFormatter.format(cursor)} - ${timeFormatter.format(slot.endsAt)}`,
        title: "Volné okno",
        subtitle: `Kapacita ${slot.capacity} • připravené pro další rezervaci`,
        badge: "VOLNE",
        href: getSlotEditHref(area, slot.id),
        createHref: getBookingsHref(area),
        editHref: getSlotEditHref(area, slot.id),
      });
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
  todayStatusLabel: string;
  nextClient: {
    timeLabel: string;
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
    emphasis: "primary" | "secondary" | "ok";
  }>;
  timelineItems: DashboardTimelineItem[];
  timelineFooterHref: string;
  kpis: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  pendingConfirmations: {
    count: number;
    href: string;
  };
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
          where: { status: { in: ACTIVE_BOOKING_STATUSES } },
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
        startsAt: { gte: now, lt: dayAfterTomorrowStart },
        status: AvailabilitySlotStatus.PUBLISHED,
      },
      orderBy: { startsAt: "asc" },
      take: 6,
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

  const nextTodayBooking =
    todayBookings.find((booking) => booking.scheduledStartsAt.getTime() >= now.getTime()) ?? null;
  const timelineItems = buildTimelineItems(area, now, todaySlots);
  const freeWindowCount = timelineItems.filter((item) => item.badge === "VOLNE").length;
  const weekOccupancy = getWeekOccupancy(weekSlots);
  const weekFreeSlots = weekSlots.filter((slot) => slot.bookings.length < slot.capacity).length;
  const upcomingFreeSlots = nearbyPublishedSlots.filter((slot) => slot.bookings.length < slot.capacity);

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
      )}`,
      href: getBookingsHref(area),
      emphasis: "primary",
    });
  }

  if (failedEmails > 0) {
    alerts.push({
      id: "email-failures",
      tone: "problem",
      text: `${failedEmails} e-mailů potřebuje kontrolu`,
      href: area === "owner" ? "/admin/email-logy" : getBookingsHref(area),
      emphasis: "secondary",
    });
  }

  if (upcomingFreeSlots.length === 0) {
    alerts.push({
      id: "nearby-slots",
      tone: "problem",
      text: "Na dnes a zítra není publikovaný žádný volný termín",
      href: getPlannerHref(area),
      emphasis: "secondary",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all-good",
      tone: "success",
      text: "Všechny rezervace jsou zpracované.",
      href: getBookingsHref(area),
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
    nextReservationSummary: nextTodayBooking
      ? formatMinutesUntil(nextTodayBooking.scheduledStartsAt, now)
      : todayBookings.length > 0
        ? "dnešní rezervace už běží"
        : "zatím bez rezervace na dnešek",
    todayStatusLabel:
      todayBookings.length > 0
        ? `Dnes je naplánováno ${todayBookings.length} ${formatCountLabel(
            todayBookings.length,
            "aktivní rezervace",
            "aktivní rezervace",
            "aktivních rezervací",
          )}.`
        : "Dnes není naplánovaná žádná rezervace.",
    nextClient: nextTodayBooking
      ? {
          timeLabel: timeFormatter.format(nextTodayBooking.scheduledStartsAt),
          relativeLabel: formatRelativeTime(nextTodayBooking.scheduledStartsAt, now),
          serviceName: nextTodayBooking.serviceNameSnapshot,
          clientName: nextTodayBooking.clientNameSnapshot,
          detailHref: getAdminBookingHref(area, nextTodayBooking.id),
          editHref: getAdminBookingHref(area, nextTodayBooking.id),
        }
      : null,
    todayTasks,
    alerts,
    timelineItems,
    timelineFooterHref: getPlannerHref(area),
    kpis: [
      {
        label: "Dnes volná okna",
        value: String(freeWindowCount),
        detail: "v dnešním rozvrhu",
      },
      {
        label: "Týdenní obsazenost",
        value: `${weekOccupancy} %`,
        detail: "podle minut a kapacity",
      },
      {
        label: "Týden volné sloty",
        value: String(weekFreeSlots),
        detail: "sloty se zbývající kapacitou",
      },
      {
        label: "Chybné e-maily",
        value: String(failedEmails),
        detail: failedEmails > 0 ? "potřebují kontrolu" : "bez chyb ve frontě",
      },
    ],
    pendingConfirmations: {
      count: pendingBookings,
      href: getBookingsHref(area),
    },
    upcomingSlots: upcomingFreeSlots.map((slot) => {
      const prefix =
        slot.startsAt >= todayStart && slot.startsAt < tomorrowStart ? "Dnes" : "Zítra";
      const remainingCapacity = Math.max(slot.capacity - slot.bookings.length, 0);

      return {
        id: slot.id,
        dayLabel: prefix,
        timeLabel: timeFormatter.format(slot.startsAt),
        metaLabel: `volno • kapacita ${remainingCapacity}`,
        href: getSlotEditHref(area, slot.id),
      };
    }),
    upcomingSlotsFooterHref: getPlannerHref(area),
    quickActions: [
      {
        id: "create-booking",
        label: "Vytvořit rezervaci",
        description: "Otevřít rezervace",
        href: getBookingsHref(area),
        icon: "booking",
      },
      {
        id: "add-slot",
        label: "Přidat termín",
        description: "Nový slot",
        href: `${getPlannerHref(area)}/novy`,
        icon: "plus",
      },
      {
        id: "edit-availability",
        label: "Upravit dostupnost",
        description: "Týdenní plán",
        href: getPlannerHref(area),
        icon: "calendar",
      },
      {
        id: "clients",
        label: "Klienti",
        description: "CRM přehled",
        href: getClientsHref(area),
        icon: "clients",
      },
    ],
  };
}
