import {
  BookingActionTokenType,
  AvailabilitySlotStatus,
  BookingSource,
  BookingStatus,
  EmailLogStatus,
  EmailLogType,
  MediaType,
  Prisma,
} from "@prisma/client";

import { type AdminArea, type AdminSectionSlug } from "@/config/navigation";
import {
  getAdminBookingActionOptions,
  getBookingAcquisitionLabel,
  getAdminBookingHref,
  getBookingSourceLabel,
  getBookingStatusLabel,
} from "@/features/admin/lib/admin-booking";
import {
  bookingListSearchParamsSchema,
  type BookingListSourceValue,
  type BookingListStatValue,
  type BookingListStatusValue,
} from "@/features/admin/lib/admin-booking-list-validation";
import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";
import { listBootstrapAdminUsers } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const formatDate = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const formatTime = new Intl.DateTimeFormat("cs-CZ", {
  hour: "2-digit",
  minute: "2-digit",
});

const formatDateTime = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return "Bez data";
  }

  return formatDate.format(value);
}

function formatDateTimeLabel(value: Date | null | undefined) {
  if (!value) {
    return "Bez času";
  }

  return formatDateTime.format(value);
}

function formatTimeRange(startsAt: Date, endsAt: Date) {
  return `${formatDateTimeLabel(startsAt)} - ${formatTime.format(endsAt)}`;
}

function statusLabel(status: BookingStatus | AvailabilitySlotStatus | EmailLogStatus) {
  switch (status) {
    case BookingStatus.PENDING:
      return "Čeká";
    case BookingStatus.CONFIRMED:
      return "Potvrzeno";
    case BookingStatus.CANCELLED:
      return "Zrušeno";
    case BookingStatus.COMPLETED:
      return "Hotovo";
    case BookingStatus.NO_SHOW:
      return "Nedorazila";
    case AvailabilitySlotStatus.DRAFT:
      return "Draft";
    case AvailabilitySlotStatus.PUBLISHED:
      return "Publikováno";
    case AvailabilitySlotStatus.CANCELLED:
      return "Zrušeno";
    case AvailabilitySlotStatus.ARCHIVED:
      return "Archiv";
    case EmailLogStatus.PENDING:
      return "Čeká";
    case EmailLogStatus.SENT:
      return "Odesláno";
    case EmailLogStatus.FAILED:
      return "Chyba";
    default:
      return String(status);
  }
}

function retryStateLabel(
  nextAttemptAt: Date | null,
  processingStartedAt: Date | null,
  attemptCount: number,
) {
  if (processingStartedAt) {
    return `Zpracovává se • pokus ${attemptCount}`;
  }

  if (attemptCount > 0) {
    return `Retry • další pokus ${formatDateTimeLabel(nextAttemptAt)}`;
  }

  return `Ve frontě • další pokus ${formatDateTimeLabel(nextAttemptAt)}`;
}

function emailTypeLabel(type: EmailLogType) {
  switch (type) {
    case EmailLogType.BOOKING_CREATED:
    case EmailLogType.BOOKING_CONFIRMED:
      return "Potvrzení rezervace";
    case EmailLogType.BOOKING_CANCELLED:
      return "Storno potvrzení";
    case EmailLogType.BOOKING_RESCHEDULED:
      return "Přesun termínu";
    case EmailLogType.BOOKING_REMINDER:
      return "Připomínka termínu";
    case EmailLogType.GENERIC:
      return "Obecný e-mail";
  }
}

function actionTokenTypeLabel(type: BookingActionTokenType) {
  switch (type) {
    case BookingActionTokenType.CANCEL:
      return "Storno token";
    case BookingActionTokenType.RESCHEDULE:
      return "Přesun termínu";
    case BookingActionTokenType.APPROVE:
      return "Schválení z e-mailu";
    case BookingActionTokenType.REJECT:
      return "Zrušení z e-mailu";
  }
}

export function getAdminSectionTitle(slug: AdminSectionSlug) {
  switch (slug) {
    case "overview":
      return "Přehled";
    case "rezervace":
      return "Rezervace";
    case "volne-terminy":
      return "Volné termíny";
    case "klienti":
      return "Klienti";
    case "media":
      return "Média webu";
    case "sluzby":
      return "Služby";
    case "kategorie-sluzeb":
      return "Kategorie služeb";
    case "uzivatele":
      return "Uživatelé / role";
    case "email-logy":
      return "Email logy";
    case "nastaveni":
      return "Nastavení";
  }
}

export async function getAdminOverviewData(area: AdminArea) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const [
    pendingBookings,
    upcomingBookings,
    todayBookings,
    todayBookingItems,
    upcomingPublishedSlots,
    draftSlots,
    activeClients,
    activeServices,
    serviceCategories,
    recentBookings,
    nextSlots,
    adminUsers,
    emailFailures,
  ] = await Promise.all([
    prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
    prisma.booking.count({
      where: {
        scheduledStartsAt: { gte: now },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
    }),
    prisma.booking.count({
      where: {
        scheduledStartsAt: { gte: todayStart, lt: tomorrowStart },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
    }),
    prisma.booking.findMany({
      where: {
        scheduledStartsAt: { gte: todayStart, lt: tomorrowStart },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
      orderBy: { scheduledStartsAt: "asc" },
      take: 4,
      include: {
        service: { select: { name: true } },
        client: { select: { fullName: true } },
      },
    }),
    prisma.availabilitySlot.count({
      where: {
        status: AvailabilitySlotStatus.PUBLISHED,
        startsAt: { gte: now },
      },
    }),
    prisma.availabilitySlot.count({
      where: { status: AvailabilitySlotStatus.DRAFT },
    }),
    prisma.client.count({ where: { isActive: true } }),
    prisma.service.count({ where: { isActive: true } }),
    prisma.serviceCategory.count({ where: { isActive: true } }),
    prisma.booking.findMany({
      where: {
        scheduledStartsAt: { gte: now },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
      orderBy: { scheduledStartsAt: "asc" },
      take: 6,
      include: {
        service: { select: { name: true } },
        client: { select: { fullName: true } },
      },
    }),
    prisma.availabilitySlot.findMany({
      where: {
        startsAt: { gte: now },
        status: { in: [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.PUBLISHED] },
      },
      orderBy: { startsAt: "asc" },
      take: 6,
      include: {
        bookings: {
          where: { status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
          select: { id: true },
        },
      },
    }),
    prisma.adminUser.count({ where: { isActive: true } }),
    prisma.emailLog.count({ where: { status: EmailLogStatus.FAILED } }),
  ]);

  return {
    stats:
      area === "owner"
        ? [
            {
              label: "Budoucí rezervace",
              value: String(upcomingBookings),
              tone: "accent" as const,
              detail: "Potvrzené a čekající termíny, které ještě proběhnou.",
            },
            {
              label: "Čeká na potvrzení",
              value: String(pendingBookings),
              detail: "Rezervace vyžadující rychlé provozní rozhodnutí.",
            },
            {
              label: "Publikované sloty",
              value: String(upcomingPublishedSlots),
              detail: "Budoucí volné termíny viditelné na veřejném webu.",
            },
            {
              label: "Draft sloty",
              value: String(draftSlots),
              detail: "Termíny připravené k doplnění nebo publikaci.",
            },
            {
              label: "Aktivní klienti",
              value: String(activeClients),
              detail: "Klientky s aktivním profilem v databázi.",
            },
            {
              label: "Služby / kategorie",
              value: `${activeServices} / ${serviceCategories}`,
              detail: "Aktivní nabídka na webu a v booking flow.",
            },
            {
              label: "Admin účty",
              value: String(adminUsers + listBootstrapAdminUsers().length),
              detail: "Součet databázových a systémových přístupů.",
            },
            {
              label: "Chybné e-maily",
              value: String(emailFailures),
              tone: emailFailures > 0 ? ("accent" as const) : ("muted" as const),
              detail: "Počet e-mailů se stavem FAILED.",
            },
          ]
        : [
            {
              label: "Dnešní rezervace",
              value: String(todayBookings),
              tone: "accent" as const,
              detail: "Termíny, které dnes potřebuje provoz odbavit.",
            },
            {
              label: "Čekající potvrzení",
              value: String(pendingBookings),
              detail: "Rezervace, které je dobré dnes zkontrolovat.",
            },
            {
              label: "Volné sloty",
              value: String(upcomingPublishedSlots),
              detail: "Publikované termíny připravené pro další booking.",
            },
            {
              label: "Aktivní klienti",
              value: String(activeClients),
              detail: "Klientská databáze dostupná recepci i provozu.",
            },
          ],
    recentBookings,
    todayBookingItems,
    nextSlots,
  };
}

export async function getAdminSectionData(section: AdminSectionSlug, area: AdminArea) {
  switch (section) {
    case "rezervace":
      return getReservationsData(area);
    case "volne-terminy":
      return getSlotsData(area);
    case "klienti":
      return getClientsData(area);
    case "media":
      return getCertificatesData(area);
    case "sluzby":
      return getServicesData(area);
    case "kategorie-sluzeb":
      return getCategoriesData(area);
    case "uzivatele":
      throw new Error("Sekce uzivatele ma vlastni specializovanou stranku.");
    case "email-logy":
      return getEmailLogsData();
    case "nastaveni":
      return getSettingsData();
    case "overview":
      return getAdminOverviewData(area);
  }
}

export type ReservationsDashboardData = {
  currentPath: string;
  filters: {
    query: string;
    status: BookingListStatusValue;
    source: BookingListSourceValue;
    stat: BookingListStatValue | null;
    dateFrom: string;
    dateTo: string;
    hasActiveFilters: boolean;
  };
  summary: {
    totalCount: number;
    totalUnfilteredCount: number;
    emptyState: "empty" | "filtered" | "pending";
  };
  stats: Array<{
    key: BookingListStatValue;
    label: string;
    value: string;
    tone?: "default" | "accent" | "muted";
    detail?: string;
    href: string;
    isActive: boolean;
  }>;
  groups: Array<{
    key: string;
    label: string;
    detail: string;
    items: Array<{
      id: string;
      title: string;
      serviceName: string;
      scheduledStartsAtIso: string;
      scheduledDateLabel: string;
      scheduledDateShortLabel: string;
      scheduledTimeLabel: string;
      status: BookingStatus;
      statusLabel: string;
      sourceLabel: string;
      acquisitionLabel: string | null;
      primaryContactLabel: string | null;
      primaryContactHref: string | null;
      secondaryContactLabel: string | null;
      secondaryContactHref: string | null;
      href: string;
      availableActions: ReturnType<typeof getAdminBookingActionOptions>;
      isMuted: boolean;
      isPending: boolean;
    }>;
  }>;
  manualBooking: {
    services: Array<{
      id: string;
      categoryName: string;
      name: string;
      durationMinutes: number;
      priceFromCzk: number | null;
    }>;
    slots: Awaited<ReturnType<typeof getPublicBookingCatalog>>["slots"];
    clients: Array<{
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
      internalNote: string | null;
    }>;
  };
};

function normalizeReservationsSearchParams(
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const parsed = bookingListSearchParamsSchema.safeParse({
    query: typeof searchParams?.query === "string" ? searchParams.query : undefined,
    status: typeof searchParams?.status === "string" ? searchParams.status : undefined,
    source: typeof searchParams?.source === "string" ? searchParams.source : undefined,
    stat: typeof searchParams?.stat === "string" ? searchParams.stat : undefined,
    dateFrom: typeof searchParams?.dateFrom === "string" ? searchParams.dateFrom : undefined,
    dateTo: typeof searchParams?.dateTo === "string" ? searchParams.dateTo : undefined,
  });

  const defaults = {
    query: "",
    status: "all" as BookingListStatusValue,
    source: "all" as BookingListSourceValue,
    stat: null as BookingListStatValue | null,
    dateFrom: "",
    dateTo: "",
  };

  if (!parsed.success) {
    return defaults;
  }

  const dateFrom = parsed.data.dateFrom ?? "";
  const dateTo = parsed.data.dateTo ?? "";

  return {
    query: parsed.data.query ?? defaults.query,
    status: parsed.data.status ?? defaults.status,
    source: parsed.data.source ?? defaults.source,
    stat: parsed.data.stat ?? defaults.stat,
    dateFrom: dateFrom <= dateTo || !dateFrom || !dateTo ? dateFrom : dateTo,
    dateTo: dateFrom <= dateTo || !dateFrom || !dateTo ? dateTo : dateFrom,
  };
}

function parseDateFilterBoundary(value: string, endOfDay = false) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function bookingStatusFromFilter(status: BookingListStatusValue) {
  switch (status) {
    case "pending":
      return BookingStatus.PENDING;
    case "confirmed":
      return BookingStatus.CONFIRMED;
    case "completed":
      return BookingStatus.COMPLETED;
    case "cancelled":
      return BookingStatus.CANCELLED;
    case "no_show":
      return BookingStatus.NO_SHOW;
    default:
      return null;
  }
}

function bookingSourceFromFilter(source: BookingListSourceValue) {
  switch (source) {
    case "web":
      return BookingSource.WEB;
    case "phone":
      return BookingSource.PHONE;
    case "instagram":
      return BookingSource.INSTAGRAM;
    case "in_person":
      return BookingSource.IN_PERSON;
    case "other":
      return BookingSource.OTHER;
    default:
      return null;
  }
}

function buildReservationsWhere(
  filters: ReturnType<typeof normalizeReservationsSearchParams>,
): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};
  const statusFilter = bookingStatusFromFilter(filters.status);
  const sourceFilter = bookingSourceFromFilter(filters.source);
  const dateFrom = parseDateFilterBoundary(filters.dateFrom);
  const dateTo = parseDateFilterBoundary(filters.dateTo, true);
  const scheduledStartsAtFilter: Prisma.DateTimeFilter = {};

  if (filters.query) {
    where.OR = [
      { clientNameSnapshot: { contains: filters.query, mode: "insensitive" } },
      { clientEmailSnapshot: { contains: filters.query, mode: "insensitive" } },
      { clientPhoneSnapshot: { contains: filters.query, mode: "insensitive" } },
      { serviceNameSnapshot: { contains: filters.query, mode: "insensitive" } },
    ];
  }

  if (statusFilter) {
    where.status = statusFilter;
  }

  if (sourceFilter) {
    where.source = sourceFilter;
  }

  if (filters.stat === "upcoming") {
    scheduledStartsAtFilter.gte = dateFrom ?? startOfToday();
  } else if (dateFrom) {
    scheduledStartsAtFilter.gte = dateFrom;
  }

  if (dateTo) {
    scheduledStartsAtFilter.lte = dateTo;
  }

  if (scheduledStartsAtFilter.gte || scheduledStartsAtFilter.lte) {
    where.scheduledStartsAt = scheduledStartsAtFilter;
  }

  if (!statusFilter && filters.stat && filters.stat !== "upcoming") {
    const statStatus = bookingStatusFromFilter(filters.stat);

    if (statStatus) {
      where.status = statStatus;
    }
  }

  return where;
}

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfTomorrow(todayStart: Date) {
  const value = new Date(todayStart);
  value.setDate(value.getDate() + 1);
  return value;
}

function formatGroupDateLabel(value: Date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
  }).format(value);
}

function buildReservationsQueryString(
  filters: Partial<ReturnType<typeof normalizeReservationsSearchParams>>,
) {
  const params = new URLSearchParams();

  if (filters.query) {
    params.set("query", filters.query);
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.source && filters.source !== "all") {
    params.set("source", filters.source);
  }

  if (filters.stat) {
    params.set("stat", filters.stat);
  }

  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }

  return params.toString();
}

function buildReservationsStatHref(
  currentPath: string,
  filters: ReturnType<typeof normalizeReservationsSearchParams>,
  target: BookingListStatValue,
) {
  const nextQuery = buildReservationsQueryString({
    ...filters,
    stat: filters.stat === target ? null : target,
  });

  return nextQuery ? `${currentPath}?${nextQuery}` : currentPath;
}

function describeReservationsEmptyState(
  filters: ReturnType<typeof normalizeReservationsSearchParams>,
  totalUnfilteredCount: number,
  totalCount: number,
) {
  if (totalCount > 0) {
    return "filtered" as const;
  }

  if (totalUnfilteredCount === 0) {
    return "empty" as const;
  }

  if (
    filters.stat === "pending" &&
    !filters.query &&
    filters.status === "all" &&
    filters.source === "all" &&
    !filters.dateFrom &&
    !filters.dateTo
  ) {
    return "pending" as const;
  }

  return "filtered" as const;
}

function buildBookingContacts(booking: {
  clientPhoneSnapshot: string | null;
  clientEmailSnapshot: string;
}) {
  const phone = booking.clientPhoneSnapshot?.trim() ?? "";
  const email = booking.clientEmailSnapshot.trim();

  if (phone) {
    return {
      primaryContactLabel: phone,
      primaryContactHref: `tel:${phone.replace(/\s+/g, "")}`,
      secondaryContactLabel: email || null,
      secondaryContactHref: email ? `mailto:${email}` : null,
    };
  }

  return {
    primaryContactLabel: email || null,
    primaryContactHref: email ? `mailto:${email}` : null,
    secondaryContactLabel: null,
    secondaryContactHref: null,
  };
}

export async function getReservationsData(
  area: AdminArea,
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const todayStart = startOfToday();
  const tomorrowStart = startOfTomorrow(todayStart);
  const filters = normalizeReservationsSearchParams(searchParams);
  const where = buildReservationsWhere(filters);
  const currentPath = area === "owner" ? "/admin/rezervace" : "/admin/provoz/rezervace";

  const [today, pending, confirmed, completed, cancelled, totalUnfilteredCount, items, bookingCatalog, clients] =
    await Promise.all([
    prisma.booking.count({
      where: {
        scheduledStartsAt: { gte: todayStart },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
    }),
    prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
    prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
    prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
    prisma.booking.count({ where: { status: BookingStatus.CANCELLED } }),
    prisma.booking.count(),
    prisma.booking.findMany({
      orderBy: { scheduledStartsAt: "asc" },
      where,
      take: 80,
      include: {
        client: { select: { fullName: true } },
      },
    }),
    getPublicBookingCatalog(),
    prisma.client.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ lastBookedAt: "desc" }, { fullName: "asc" }],
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        internalNote: true,
      },
    }),
    ]);

  const groupedItems = new Map<
    string,
    {
      key: string;
      label: string;
      detail: string;
      items: ReservationsDashboardData["groups"][number]["items"];
    }
  >();

  for (const booking of items) {
    const startsAt = booking.scheduledStartsAt;
    const contacts = buildBookingContacts(booking);
    const sourceLabel = getBookingSourceLabel(booking.source);
    const acquisitionLabel = getBookingAcquisitionLabel(booking.acquisitionSource);

    let groupKey = "later";
    let groupLabel = "Později";
    let groupDetail = "Budoucí rezervace mimo nejbližší dny.";

    if (startsAt < todayStart) {
      groupKey = "past";
      groupLabel = "Dříve";
      groupDetail = "Minulé rezervace pro dohledání a kontrolu.";
    } else if (startsAt < tomorrowStart) {
      groupKey = "today";
      groupLabel = "Dnes";
      groupDetail = formatGroupDateLabel(startsAt);
    } else {
      const dayAfterTomorrow = new Date(tomorrowStart);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      if (startsAt < dayAfterTomorrow) {
        groupKey = "tomorrow";
        groupLabel = "Zítra";
        groupDetail = formatGroupDateLabel(startsAt);
      }
    }

    if (!groupedItems.has(groupKey)) {
      groupedItems.set(groupKey, {
        key: groupKey,
        label: groupLabel,
        detail: groupDetail,
        items: [],
      });
    }

    groupedItems.get(groupKey)?.items.push({
      id: booking.id,
      title: booking.client.fullName,
      serviceName: booking.serviceNameSnapshot,
      scheduledStartsAtIso: booking.scheduledStartsAt.toISOString(),
      scheduledDateLabel: formatDateLabel(booking.scheduledStartsAt),
      scheduledDateShortLabel: formatGroupDateLabel(booking.scheduledStartsAt),
      scheduledTimeLabel: `${formatTime.format(booking.scheduledStartsAt)} - ${formatTime.format(booking.scheduledEndsAt)}`,
      status: booking.status,
      statusLabel: getBookingStatusLabel(booking.status),
      sourceLabel,
      acquisitionLabel,
      primaryContactLabel: contacts.primaryContactLabel,
      primaryContactHref: contacts.primaryContactHref,
      secondaryContactLabel: contacts.secondaryContactLabel,
      secondaryContactHref: contacts.secondaryContactHref,
      href: getAdminBookingHref(area, booking.id),
      availableActions: getAdminBookingActionOptions(booking.status),
      isMuted: booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.CANCELLED,
      isPending: booking.status === BookingStatus.PENDING,
    });
  }

  const totalCount = items.length;
  const hasActiveFilters = Boolean(
    filters.query ||
      filters.status !== "all" ||
      filters.source !== "all" ||
      filters.stat ||
      filters.dateFrom ||
      filters.dateTo,
  );
  const emptyState = describeReservationsEmptyState(filters, totalUnfilteredCount, totalCount);
  const groupOrder = ["today", "tomorrow", "later", "past"];

  return {
    currentPath,
    filters: {
      ...filters,
      hasActiveFilters,
    },
    summary: {
      totalCount,
      totalUnfilteredCount,
      emptyState,
    },
    stats: [
      {
        key: "upcoming",
        label: "Dnes a dál",
        value: String(today),
        tone: "accent" as const,
        href: buildReservationsStatHref(currentPath, filters, "upcoming"),
        isActive: filters.stat === "upcoming",
      },
      {
        key: "pending",
        label: "Čeká",
        value: String(pending),
        href: buildReservationsStatHref(currentPath, filters, "pending"),
        isActive: filters.stat === "pending",
      },
      {
        key: "confirmed",
        label: "Potvrzené",
        value: String(confirmed),
        href: buildReservationsStatHref(currentPath, filters, "confirmed"),
        isActive: filters.stat === "confirmed",
      },
      {
        key: "completed",
        label: "Hotovo",
        value: String(completed),
        tone: "muted" as const,
        href: buildReservationsStatHref(currentPath, filters, "completed"),
        isActive: filters.stat === "completed",
      },
      {
        key: "cancelled",
        label: "Zrušené",
        value: String(cancelled),
        tone: "muted" as const,
        href: buildReservationsStatHref(currentPath, filters, "cancelled"),
        isActive: filters.stat === "cancelled",
      },
    ],
    groups: Array.from(groupedItems.values())
      .map((group) => ({
        ...group,
        items: [...group.items].sort((left, right) => {
          const priority = (item: (typeof group.items)[number]) => {
            if (item.status === BookingStatus.PENDING) {
              return 0;
            }

            if (item.status === BookingStatus.CONFIRMED) {
              return 1;
            }

            return 2;
          };

          return (
            priority(left) - priority(right) ||
            left.scheduledStartsAtIso.localeCompare(right.scheduledStartsAtIso)
          );
        }),
      }))
      .sort((left, right) => groupOrder.indexOf(left.key) - groupOrder.indexOf(right.key)),
    manualBooking: {
      services: bookingCatalog.services.map((service) => ({
        id: service.id,
        categoryName: service.categoryName,
        name: service.name,
        durationMinutes: service.durationMinutes,
        priceFromCzk: service.priceFromCzk,
      })),
      slots: bookingCatalog.slots,
      clients,
    },
  } satisfies ReservationsDashboardData;
}

async function getSlotsData(area: AdminArea) {
  const [published, draft, items] = await Promise.all([
    prisma.availabilitySlot.count({ where: { status: AvailabilitySlotStatus.PUBLISHED } }),
    prisma.availabilitySlot.count({ where: { status: AvailabilitySlotStatus.DRAFT } }),
    prisma.availabilitySlot.findMany({
      orderBy: { startsAt: "asc" },
      take: 10,
      include: {
        bookings: {
          where: { status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
          select: { id: true },
        },
        allowedServices: {
          include: { service: { select: { name: true } } },
        },
      },
    }),
  ]);

  return {
    stats: [
      { label: "Publikované", value: String(published), tone: "accent" as const },
      { label: "Draft", value: String(draft) },
    ],
    items: items.map((slot) => ({
      id: slot.id,
      title: formatTimeRange(slot.startsAt, slot.endsAt),
      meta: `Kapacita ${slot.capacity} • Obsazeno ${slot.bookings.length} • ${statusLabel(slot.status)}`,
      description:
        area === "owner"
          ? `Služby: ${
              slot.allowedServices.length > 0
                ? slot.allowedServices.map((item) => item.service.name).join(", ")
                : "bez omezení"
            }. ${slot.internalNote ?? slot.publicNote ?? "Bez poznámky."}`
          : slot.publicNote ?? "Bez veřejné poznámky ke slotu.",
      badge: statusLabel(slot.status),
    })),
  };
}

async function getClientsData(area: AdminArea) {
  const [active, inactive, items] = await Promise.all([
    prisma.client.count({ where: { isActive: true } }),
    prisma.client.count({ where: { isActive: false } }),
    prisma.client.findMany({
      orderBy: [{ lastBookedAt: "desc" }, { createdAt: "desc" }],
      take: 10,
      include: {
        _count: { select: { bookings: true } },
      },
    }),
  ]);

  return {
    stats: [
      { label: "Aktivní", value: String(active), tone: "accent" as const },
      { label: "Neaktivní", value: String(inactive), tone: "muted" as const },
    ],
    items: items.map((client) => ({
      id: client.id,
      title: client.fullName,
      meta: `${client.email}${client.phone ? ` • ${client.phone}` : ""}`,
      description:
        area === "owner"
          ? `Rezervací: ${client._count.bookings}. Poslední booking: ${formatDateLabel(client.lastBookedAt)}.`
          : `Rezervací: ${client._count.bookings}. Poslední návštěva: ${formatDateLabel(client.lastBookedAt)}.`,
      badge: client.isActive ? "Aktivní" : "Neaktivní",
    })),
  };
}

async function getCertificatesData(area: AdminArea) {
  const [publicCertificates, recentCertificates] = await Promise.all([
    prisma.mediaAsset.count({
      where: {
        type: MediaType.CERTIFICATE,
        isPublished: true,
      },
    }),
    prisma.mediaAsset.findMany({
      where: {
        type: MediaType.CERTIFICATE,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return {
    stats: [
      {
        label: "Veřejné certifikáty",
        value: String(publicCertificates),
        tone: "accent" as const,
      },
    ],
    items: recentCertificates.map((asset) => ({
      id: asset.id,
      title: asset.title || asset.fileName,
      meta: `${asset.mimeType} • ${Math.round(asset.size / 1024)} KB`,
      description: area === "owner"
        ? `Nahráno ${formatDateLabel(asset.createdAt)} • soubor ${asset.storedFilename}`
        : `Nahráno ${formatDateLabel(asset.createdAt)}`,
      badge: asset.isPublished ? "Veřejné" : "Nepublikováno",
    })),
  };
}

async function getServicesData(area: AdminArea) {
  const [active, inactive, items] = await Promise.all([
    prisma.service.count({ where: { isActive: true } }),
    prisma.service.count({ where: { isActive: false } }),
    prisma.service.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      take: 12,
      include: { category: { select: { name: true } } },
    }),
  ]);

  return {
    stats: [
      { label: "Aktivní služby", value: String(active), tone: "accent" as const },
      { label: "Skryté služby", value: String(inactive), tone: "muted" as const },
    ],
    items: items.map((service) => ({
      id: service.id,
      title: service.name,
      meta: `${service.category.name} • ${service.durationMinutes} min`,
      description:
        area === "owner"
          ? `Cena ${service.priceFromCzk ? `${service.priceFromCzk} Kč` : "nenastavena"}. Slug: ${service.slug}.`
          : `Cena ${service.priceFromCzk ? `${service.priceFromCzk} Kč` : "nenastavena"}.`,
      badge: service.isActive ? "Aktivní" : "Skryté",
    })),
  };
}

async function getCategoriesData(area: AdminArea) {
  const [active, items] = await Promise.all([
    prisma.serviceCategory.count({ where: { isActive: true } }),
    prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 12,
      include: {
        _count: { select: { services: true } },
      },
    }),
  ]);

  return {
    stats: [{ label: "Aktivní kategorie", value: String(active), tone: "accent" as const }],
    items: items.map((category) => ({
      id: category.id,
      title: category.name,
      meta: `${category._count.services} služeb • pořadí ${category.sortOrder}`,
      description:
        area === "owner"
          ? `${category.description ?? "Bez popisu."} Slug: ${category.slug}.`
          : category.description ?? "Kategorie zatím nemá doplněný popis.",
      badge: category.isActive ? "Aktivní" : "Skryté",
    })),
  };
}

type EmailLogItem = {
  id: string;
  title: string;
  meta?: string;
  description?: string;
  badge?: string;
  href?: string;
};

export type EmailLogsDashboardData = {
  stats: Array<{
    label: string;
    value: string;
    tone?: "default" | "accent" | "muted";
    detail?: string;
  }>;
  pendingItems: EmailLogItem[];
  retryingItems: EmailLogItem[];
  failedItems: EmailLogItem[];
};

export type EmailLogDetailData = {
  id: string;
  status: EmailLogStatus;
  statusLabel: string;
  type: EmailLogType;
  typeLabel: string;
  recipientEmail: string;
  subject: string;
  templateKey: string;
  attemptCount: number;
  queueStateLabel: string;
  isProcessing: boolean;
  isStuck: boolean;
  canRetry: boolean;
  canRelease: boolean;
  nextAttemptLabel: string;
  processingStartedLabel: string;
  sentAtLabel: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  providerLabel: string;
  providerMessageIdLabel: string;
  errorMessage: string | null;
  payload: Prisma.JsonValue | null;
  bookingSummary: string;
  clientSummary: string;
  actionTokenSummary: string;
};

async function getEmailLogsData(): Promise<EmailLogsDashboardData> {
  const now = new Date();
  const [
    pending,
    retrying,
    processing,
    sent,
    failed,
    pendingItems,
    retryingItems,
    failedItems,
  ] = await Promise.all([
    prisma.emailLog.count({
      where: {
        status: EmailLogStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: { lte: now },
        processingStartedAt: null,
      },
    }),
    prisma.emailLog.count({
      where: {
        status: EmailLogStatus.PENDING,
        attemptCount: { gt: 0 },
      },
    }),
    prisma.emailLog.count({
      where: {
        status: EmailLogStatus.PENDING,
        processingStartedAt: { not: null },
      },
    }),
    prisma.emailLog.count({ where: { status: EmailLogStatus.SENT } }),
    prisma.emailLog.count({ where: { status: EmailLogStatus.FAILED } }),
    prisma.emailLog.findMany({
      where: {
        status: EmailLogStatus.PENDING,
        attemptCount: 0,
        nextAttemptAt: { lte: now },
        processingStartedAt: null,
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: 6,
      include: {
        booking: { select: { clientNameSnapshot: true } },
      },
    }),
    prisma.emailLog.findMany({
      where: {
        status: EmailLogStatus.PENDING,
        attemptCount: { gt: 0 },
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "desc" }],
      take: 6,
      include: {
        booking: { select: { clientNameSnapshot: true } },
      },
    }),
    prisma.emailLog.findMany({
      where: {
        status: EmailLogStatus.FAILED,
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        booking: { select: { clientNameSnapshot: true } },
      },
    }),
  ]);

  return {
    stats: [
      {
        label: "Ve frontě",
        value: String(pending),
        tone: "accent" as const,
        detail: "E-maily připravené k nejbližšímu zpracování.",
      },
      {
        label: "Retrying",
        value: String(retrying),
        detail: "Pokusy, které worker vrátí na další retry.",
      },
      {
        label: "Zpracovává se",
        value: String(processing),
        tone: "muted" as const,
        detail: "Záznamy, které worker právě claimuje.",
      },
      {
        label: "Odesláno",
        value: String(sent),
        detail: "Úspěšně doručené e-maily.",
      },
      {
        label: "Chyby",
        value: String(failed),
        tone: failed > 0 ? ("accent" as const) : ("muted" as const),
        detail: "Selhané záznamy po vyčerpání retry politiky.",
      },
    ],
    pendingItems: pendingItems.map((log) => ({
      id: log.id,
      title: `${log.subject} • ${log.recipientEmail}`,
      meta: retryStateLabel(log.nextAttemptAt, log.processingStartedAt, log.attemptCount),
      description: `${log.type} • klientka ${log.booking?.clientNameSnapshot ?? "bez rezervace"}`,
      badge: "pending",
      href: `/admin/email-logy/${log.id}`,
    })),
    retryingItems: retryingItems.map((log) => ({
      id: log.id,
      title: `${log.subject} • ${log.recipientEmail}`,
      meta: retryStateLabel(log.nextAttemptAt, log.processingStartedAt, log.attemptCount),
      description: `${log.type} • ${log.errorMessage ?? "Bez poslední chyby"}`,
      badge: "retry",
      href: `/admin/email-logy/${log.id}`,
    })),
    failedItems: failedItems.map((log) => ({
      id: log.id,
      title: `${log.subject} • ${log.recipientEmail}`,
      meta: `${statusLabel(log.status)} • ${formatDateTimeLabel(log.updatedAt)}`,
      description: `${log.type} • ${log.errorMessage ?? "Bez textu chyby"} • klientka ${log.booking?.clientNameSnapshot ?? "bez rezervace"}`,
      badge: "chyba",
      href: `/admin/email-logy/${log.id}`,
    })),
  };
}

export async function getEmailLogDetailData(emailLogId: string): Promise<EmailLogDetailData | null> {
  const now = new Date();
  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
    include: {
      booking: {
        select: {
          id: true,
          clientNameSnapshot: true,
          clientEmailSnapshot: true,
          serviceNameSnapshot: true,
          scheduledStartsAt: true,
          scheduledEndsAt: true,
          status: true,
        },
      },
      client: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          isActive: true,
        },
      },
      actionToken: {
        select: {
          id: true,
          type: true,
          expiresAt: true,
          usedAt: true,
          revokedAt: true,
        },
      },
    },
  });

  if (!emailLog) {
    return null;
  }

  const processingStartedAt = emailLog.processingStartedAt;
  const isProcessing = processingStartedAt !== null;
  const isStuck =
    isProcessing && now.getTime() - processingStartedAt.getTime() > 10 * 60 * 1000;

  return {
    id: emailLog.id,
    status: emailLog.status,
    statusLabel: statusLabel(emailLog.status),
    type: emailLog.type,
    typeLabel: emailTypeLabel(emailLog.type),
    recipientEmail: emailLog.recipientEmail,
    subject: emailLog.subject,
    templateKey: emailLog.templateKey,
    attemptCount: emailLog.attemptCount,
    queueStateLabel: retryStateLabel(
      emailLog.nextAttemptAt,
      emailLog.processingStartedAt,
      emailLog.attemptCount,
    ),
    isProcessing,
    isStuck,
    canRetry: emailLog.status !== EmailLogStatus.SENT && !isProcessing,
    canRelease: isProcessing && emailLog.status === EmailLogStatus.PENDING,
    nextAttemptLabel: formatDateTimeLabel(emailLog.nextAttemptAt),
    processingStartedLabel: formatDateTimeLabel(emailLog.processingStartedAt),
    sentAtLabel: formatDateTimeLabel(emailLog.sentAt),
    createdAtLabel: formatDateTimeLabel(emailLog.createdAt),
    updatedAtLabel: formatDateTimeLabel(emailLog.updatedAt),
    providerLabel: emailLog.provider ?? "Bez providera",
    providerMessageIdLabel: emailLog.providerMessageId ?? "Bez message id",
    errorMessage: emailLog.errorMessage,
    payload: emailLog.payload,
    bookingSummary: emailLog.booking
      ? `${emailLog.booking.clientNameSnapshot} • ${emailLog.booking.serviceNameSnapshot} • ${formatDateTimeLabel(emailLog.booking.scheduledStartsAt)} - ${formatTime.format(emailLog.booking.scheduledEndsAt)}`
      : "Bez navázané rezervace",
    clientSummary: emailLog.client
      ? `${emailLog.client.fullName} • ${emailLog.client.email}${emailLog.client.phone ? ` • ${emailLog.client.phone}` : ""}`
      : "Bez navázaného klienta",
    actionTokenSummary: emailLog.actionToken
      ? `${actionTokenTypeLabel(emailLog.actionToken.type)} • expirace ${formatDateTimeLabel(emailLog.actionToken.expiresAt)}${emailLog.actionToken.usedAt ? ` • použito ${formatDateTimeLabel(emailLog.actionToken.usedAt)}` : ""}${emailLog.actionToken.revokedAt ? ` • zrušeno ${formatDateTimeLabel(emailLog.actionToken.revokedAt)}` : ""}`
      : "Bez navázaného action tokenu",
  };
}

async function getSettingsData() {
  const items = await prisma.setting.findMany({
    orderBy: { updatedAt: "desc" },
    take: 12,
    include: {
      updatedByUser: { select: { name: true } },
    },
  });

  return {
    stats: [
      {
        label: "Záznamy nastavení",
        value: String(items.length),
        tone: "accent" as const,
      },
    ],
    items: items.map((setting) => ({
      id: setting.id,
      title: setting.key,
      meta: `Upraveno ${formatDateTimeLabel(setting.updatedAt)}`,
      description: `${setting.description ?? "Bez popisu."} Poslední změna: ${setting.updatedByUser?.name ?? "systém"}.`,
      badge: "Server",
    })),
  };
}
