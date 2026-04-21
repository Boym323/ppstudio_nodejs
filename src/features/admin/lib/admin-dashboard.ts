import { AvailabilitySlotStatus, BookingStatus, EmailLogStatus } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import { getAdminBookingHref } from "@/features/admin/lib/admin-booking";
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

const dayAndTimeFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type DashboardAlertTone = "warning" | "problem" | "success";

type DashboardTimelineItem = {
  id: string;
  timeLabel: string;
  title: string;
  subtitle: string;
  badge: "VOLNE" | "REZERVACE";
  href: string;
};

type DashboardUpcomingSlot = {
  id: string;
  dateTimeLabel: string;
  capacityLabel: string;
  badge: string;
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
  slots: Array<{
    id: string;
    startsAt: Date;
    endsAt: Date;
    capacity: number;
    bookings: Array<{
      id: string;
      scheduledStartsAt: Date;
      scheduledEndsAt: Date;
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
          timeLabel: `${timeFormatter.format(cursor)} - ${timeFormatter.format(booking.scheduledStartsAt)}`,
          title: "Volné okno",
          subtitle: `Kapacita ${slot.capacity} • připravené pro další rezervaci`,
          badge: "VOLNE",
          href: getSlotEditHref(area, slot.id),
        });
      }

      items.push({
        id: booking.id,
        timeLabel: `${timeFormatter.format(booking.scheduledStartsAt)} - ${timeFormatter.format(booking.scheduledEndsAt)}`,
        title: booking.serviceNameSnapshot,
        subtitle: booking.clientNameSnapshot,
        badge: "REZERVACE",
        href: getAdminBookingHref(area, booking.id),
      });

      if (booking.scheduledEndsAt.getTime() > cursor.getTime()) {
        cursor = booking.scheduledEndsAt;
      }
    }

    if (cursor.getTime() < slot.endsAt.getTime()) {
      items.push({
        id: `${slot.id}-free-${slot.endsAt.toISOString()}`,
        timeLabel: `${timeFormatter.format(cursor)} - ${timeFormatter.format(slot.endsAt)}`,
        title: "Volné okno",
        subtitle: `Kapacita ${slot.capacity} • připravené pro další rezervaci`,
        badge: "VOLNE",
        href: getSlotEditHref(area, slot.id),
      });
    }
  }

  return items.sort((left, right) => left.timeLabel.localeCompare(right.timeLabel, "cs-CZ"));
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
  nextReservationSummary: string;
  nextClient: {
    timeLabel: string;
    serviceName: string;
    clientName: string;
    detailHref: string;
    editHref: string;
  } | null;
  alerts: Array<{
    id: string;
    tone: DashboardAlertTone;
    text: string;
    href: string;
  }>;
  timelineItems: DashboardTimelineItem[];
  timelineFooterHref: string;
  kpis: Array<{
    label: string;
    value: string;
  }>;
  quickStats: Array<{
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
    draftSlots,
    activeClients,
    activeServices,
    serviceCategories,
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
    prisma.availabilitySlot.count({
      where: {
        status: AvailabilitySlotStatus.DRAFT,
      },
    }),
    prisma.client.count({ where: { isActive: true } }),
    prisma.service.count({ where: { isActive: true } }),
    prisma.serviceCategory.count({ where: { isActive: true } }),
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
  const timelineItems = buildTimelineItems(area, todaySlots);
  const freeWindowCount = timelineItems.filter((item) => item.badge === "VOLNE").length;
  const weekOccupancy = getWeekOccupancy(weekSlots);
  const weekFreeSlots = weekSlots.filter((slot) => slot.bookings.length < slot.capacity).length;

  const alerts: AdminDashboardData["alerts"] = [];

  if (pendingBookings > 0) {
    alerts.push({
      id: "pending-bookings",
      tone: "warning",
      text: `${pendingBookings} rezervace čekají na potvrzení`,
      href: getBookingsHref(area),
    });
  }

  if (failedEmails > 0) {
    alerts.push({
      id: "email-failures",
      tone: "problem",
      text: `${failedEmails} e-mailů potřebuje kontrolu`,
      href: area === "owner" ? "/admin/email-logy" : getBookingsHref(area),
    });
  }

  if (nearbyPublishedSlots.length === 0) {
    alerts.push({
      id: "nearby-slots",
      tone: "problem",
      text: "Na dnes a zítra není publikovaný žádný volný termín",
      href: getPlannerHref(area),
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all-good",
      tone: "success",
      text: "Vše je v pořádku",
      href: getBookingsHref(area),
    });
  }

  return {
    area,
    todayLabel: `Dnes • ${formatDayLabel(now)}`,
    todayBookingsCount: todayBookings.length,
    nextReservationSummary: nextTodayBooking
      ? formatMinutesUntil(nextTodayBooking.scheduledStartsAt, now)
      : todayBookings.length > 0
        ? "dnešní rezervace už běží"
        : "zatím bez rezervace na dnešek",
    nextClient: nextTodayBooking
      ? {
          timeLabel: timeFormatter.format(nextTodayBooking.scheduledStartsAt),
          serviceName: nextTodayBooking.serviceNameSnapshot,
          clientName: nextTodayBooking.clientNameSnapshot,
          detailHref: getAdminBookingHref(area, nextTodayBooking.id),
          editHref: getAdminBookingHref(area, nextTodayBooking.id),
        }
      : null,
    alerts,
    timelineItems,
    timelineFooterHref: getPlannerHref(area),
    kpis: [
      {
        label: "Aktivní klienti",
        value: String(activeClients),
      },
      {
        label: "Služby / kategorie",
        value: `${activeServices} / ${serviceCategories}`,
      },
      {
        label: "Draft sloty",
        value: String(draftSlots),
      },
      {
        label: "Chybné e-maily",
        value: String(failedEmails),
      },
    ],
    quickStats: [
      {
        label: "Dnes rezervace",
        value: String(todayBookings.length),
        detail: "aktivní termíny",
      },
      {
        label: "Dnes volná okna",
        value: String(freeWindowCount),
        detail: "v dnešním plánu",
      },
      {
        label: "Týden obsazenost",
        value: `${weekOccupancy} %`,
        detail: "podle slot minut",
      },
      {
        label: "Týden volné sloty",
        value: String(weekFreeSlots),
        detail: "se zbývající kapacitou",
      },
    ],
    pendingConfirmations: {
      count: pendingBookings,
      href: getBookingsHref(area),
    },
    upcomingSlots: nearbyPublishedSlots.map((slot) => {
      const prefix =
        slot.startsAt >= todayStart && slot.startsAt < tomorrowStart ? "Dnes" : "Zítra";

      return {
        id: slot.id,
        dateTimeLabel: `${prefix} • ${dayAndTimeFormatter.format(slot.startsAt)}`,
        capacityLabel: `Kapacita ${slot.capacity} • obsazeno ${slot.bookings.length}`,
        badge: "PUBLISHED",
        href: getSlotEditHref(area, slot.id),
      };
    }),
    upcomingSlotsFooterHref: getPlannerHref(area),
    quickActions: [
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
        id: "create-booking",
        label: "Vytvořit rezervaci",
        description: "Otevřít rezervace",
        href: getBookingsHref(area),
        icon: "booking",
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
