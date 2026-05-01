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

function formatDateLabel(value: Date | null | undefined): string {
  if (!value) {
    return "Bez data";
  }

  return formatDate.format(value);
}

function formatDateTimeLabel(value: Date | null | undefined): string {
  if (!value) {
    return "Bez času";
  }

  return formatDateTime.format(value);
}

function formatTimeRange(startsAt: Date, endsAt: Date): string {
  return `${formatDateTimeLabel(startsAt)} - ${formatTime.format(endsAt)}`;
}

function statusLabel(status: BookingStatus | AvailabilitySlotStatus | EmailLogStatus): string {
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
): string {
  if (processingStartedAt) {
    return `Zpracovává se • pokus ${attemptCount}`;
  }

  if (attemptCount > 0) {
    return `Retry • další pokus ${formatDateTimeLabel(nextAttemptAt)}`;
  }

  return `Ve frontě • další pokus ${formatDateTimeLabel(nextAttemptAt)}`;
}

function getEmailDetailFinalStatus(
  status: EmailLogStatus,
  sentAt: Date | null,
  processingStartedAt: Date | null,
  attemptCount: number,
  nextAttemptAt: Date | null,
  updatedAt: Date,
): {
  value: "sent" | "pending" | "retry" | "failed";
  label: string;
  detail: string;
  needsAttention: boolean;
} {
  if (sentAt) {
    return {
      value: "sent" as const,
      label: "Odesláno",
      detail: `Odesláno ${formatDateTimeLabel(sentAt)}`,
      needsAttention: false,
    };
  }

  if (attemptCount > 0 && status !== EmailLogStatus.FAILED) {
    return {
      value: "retry" as const,
      label: "Retry",
      detail: processingStartedAt
        ? `Probíhá další pokus od ${formatDateTimeLabel(processingStartedAt)}`
        : `Další pokus ${formatDateTimeLabel(nextAttemptAt)}`,
      needsAttention: true,
    };
  }

  if (status === EmailLogStatus.FAILED) {
    return {
      value: "failed" as const,
      label: "Selhalo",
      detail: `Poslední pokus ${formatDateTimeLabel(processingStartedAt ?? updatedAt)}`,
      needsAttention: true,
    };
  }

  return {
    value: "pending" as const,
    label: "Čeká",
    detail: processingStartedAt
      ? `První pokus běží od ${formatDateTimeLabel(processingStartedAt)}`
      : `Ve frontě od ${formatDateTimeLabel(nextAttemptAt)}`,
    needsAttention: false,
  };
}

function getErrorSummary(errorMessage: string | null) {
  if (!errorMessage) {
    return null;
  }

  const summary = errorMessage
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return summary ?? "Chyba bez detailu.";
}

function emailTypeLabel(type: EmailLogType): string {
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
    case EmailLogType.VOUCHER_SENT:
      return "Odeslání voucheru";
    case EmailLogType.GENERIC:
      return "Obecný e-mail";
  }

  return "Neznámý typ e-mailu";
}

function actionTokenTypeLabel(type: BookingActionTokenType): string {
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

  return "Neznámý action token";
}

export function getAdminSectionTitle(slug: AdminSectionSlug) {
  switch (slug) {
    case "overview":
      return "Přehled";
    case "rezervace":
      return "Rezervace";
    case "volne-terminy":
      return "Volné termíny";
    case "vouchery":
      return "Vouchery";
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
    case "vouchery":
      throw new Error("Sekce vouchery ma vlastni specializovanou stranku.");
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
  kpis: Array<{
    key: "pending" | "today" | "week" | "missing-contact";
    label: string;
    value: string;
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

function startOfWeek(todayStart: Date) {
  const value = new Date(todayStart);
  const day = value.getDay();
  const offset = day === 0 ? 6 : day - 1;
  value.setDate(value.getDate() - offset);
  return value;
}

function startOfNextWeek(weekStart: Date) {
  const value = new Date(weekStart);
  value.setDate(value.getDate() + 7);
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
  const weekStart = startOfWeek(todayStart);
  const nextWeekStart = startOfNextWeek(weekStart);
  const filters = normalizeReservationsSearchParams(searchParams);
  const where = buildReservationsWhere(filters);
  const currentPath = area === "owner" ? "/admin/rezervace" : "/admin/provoz/rezervace";

  const [
    today,
    pending,
    confirmed,
    completed,
    cancelled,
    todayKpi,
    weekKpi,
    missingContactKpi,
    totalUnfilteredCount,
    items,
    bookingCatalog,
    clients,
  ] =
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
    prisma.booking.count({
      where: {
        scheduledStartsAt: {
          gte: todayStart,
          lt: tomorrowStart,
        },
      },
    }),
    prisma.booking.count({
      where: {
        scheduledStartsAt: {
          gte: weekStart,
          lt: nextWeekStart,
        },
      },
    }),
    prisma.booking.count({
      where: {
        AND: [
          {
            clientEmailSnapshot: "",
          },
          {
            OR: [
              { clientPhoneSnapshot: null },
              { clientPhoneSnapshot: "" },
            ],
          },
        ],
      },
    }),
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

    let groupKey = "upcoming";
    let groupLabel = "Nadcházející";
    let groupDetail = "Potvrzené a další aktivní rezervace od dneška dál.";

    if (booking.status === BookingStatus.PENDING) {
      groupKey = "pending";
      groupLabel = "Čeká na potvrzení";
      groupDetail = "Rezervace vyžadující rychlé provozní rozhodnutí.";
    } else if (
      startsAt < todayStart ||
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.NO_SHOW
    ) {
      groupKey = "past";
      groupLabel = "Minulé";
      groupDetail = "Hotové, zrušené a historické rezervace pro dohledání.";
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
      availableActions: getAdminBookingActionOptions(booking.status, {
        scheduledEndsAt: booking.scheduledEndsAt,
      }),
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
  const groupOrder = ["pending", "upcoming", "past"];

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
    kpis: [
      {
        key: "pending",
        label: "Čeká na potvrzení",
        value: String(pending),
      },
      {
        key: "today",
        label: "Dnes",
        value: String(todayKpi),
      },
      {
        key: "week",
        label: "Tento týden",
        value: String(weekKpi),
      },
      {
        key: "missing-contact",
        label: "Bez kontaktu",
        value: String(missingContactKpi),
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
      .sort((left, right) => groupOrder.indexOf(left.key) - groupOrder.indexOf(right.key))
      .filter((group) => group.items.length > 0),
    manualBooking: {
      services: bookingCatalog.services.map((service) => ({
        id: service.id,
        categoryName: service.categoryName,
        name: service.name,
        durationMinutes: service.durationMinutes,
        priceFromCzk: service.priceFromCzk,
      })),
      slots: bookingCatalog.slots,
      clients: clients.map((client) => ({
        ...client,
        email: client.email ?? "",
      })),
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
      meta: `${client.email ?? "Bez e-mailu"}${client.phone ? ` • ${client.phone}` : ""}`,
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

type EmailHealthTone = "ok" | "warning" | "error";

type EmailRecentStatusValue = "sent" | "pending" | "processing" | "retry" | "failed";

type EmailRecentTypeValue =
  | "booking_confirmation"
  | "reminder"
  | "cancellation"
  | "reschedule"
  | "voucher"
  | "admin"
  | "other";

export type EmailLogsDashboardData = {
  referenceNowIso: string;
  health: {
    tone: EmailHealthTone;
    title: string;
    helper: string;
    summary: string;
    latestError: string | null;
  };
  stats: Array<{
    label: string;
    value: string;
    tone?: "default" | "accent" | "muted";
    detail?: string;
  }>;
  recentEmails: Array<{
    id: string;
    typeLabel: string;
    typeValue: EmailRecentTypeValue;
    statusLabel: string;
    statusValue: EmailRecentStatusValue;
    recipientLabel: string;
    recipientEmail: string;
    bookingSummary: string | null;
    bookingHref: string | null;
    createdAtIso: string;
    createdAtLabel: string;
    sentAtLabel: string;
    activityLabel: string;
    attemptCount: number;
    lastAttemptLabel: string;
    nextAttemptLabel: string;
    errorMessage: string | null;
    trackingOpenedLabel: string;
    trackingClickedLabel: string;
    detailHref: string;
    canRetry: boolean;
  }>;
  queueStats: Array<{
    label: string;
    value: string;
    tone?: "default" | "accent" | "muted";
    detail?: string;
  }>;
  workerSummary: string;
  pendingItems: EmailLogItem[];
  retryingItems: EmailLogItem[];
  failedItems: EmailLogItem[];
};

export type EmailLogDetailData = {
  id: string;
  status: EmailLogStatus;
  statusLabel: string;
  finalStatus: "sent" | "pending" | "retry" | "failed";
  finalStatusLabel: string;
  finalStatusDetail: string;
  statusNeedsAttention: boolean;
  type: EmailLogType;
  typeLabel: string;
  recipientEmail: string;
  subject: string;
  businessTitle: string;
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
  errorSummary: string | null;
  payload: Prisma.JsonValue | null;
  bookingSummary: string;
  bookingHref: string | null;
  bookingTitle: string;
  bookingScheduleLabel: string;
  clientName: string;
  clientSummary: string;
  actionTokenId: string | null;
  actionTokenLabel: string;
  actionTokenSummary: string;
  lastAttemptLabel: string;
  headerTimestampLabel: string;
  headerTimestampTitle: string;
};

function getEmailRecentStatus(
  status: EmailLogStatus,
  processingStartedAt: Date | null,
  attemptCount: number,
): EmailRecentStatusValue {
  if (status === EmailLogStatus.SENT) {
    return "sent";
  }

  if (status === EmailLogStatus.FAILED) {
    return "failed";
  }

  if (processingStartedAt) {
    return "processing";
  }

  if (attemptCount > 0) {
    return "retry";
  }

  return "pending";
}

function getEmailRecentStatusLabel(
  status: EmailLogStatus,
  processingStartedAt: Date | null,
  attemptCount: number,
): string {
  switch (getEmailRecentStatus(status, processingStartedAt, attemptCount)) {
    case "sent":
      return "Odesláno";
    case "pending":
      return "Čeká";
    case "processing":
      return "Zpracovává se";
    case "retry":
      return "Retry";
    case "failed":
      return "Selhalo";
  }
}

function getEmailTypeCategory(type: EmailLogType, templateKey: string): EmailRecentTypeValue {
  if (templateKey.startsWith("admin-")) {
    return "admin";
  }

  switch (type) {
    case EmailLogType.BOOKING_CREATED:
    case EmailLogType.BOOKING_CONFIRMED:
      return "booking_confirmation";
    case EmailLogType.BOOKING_REMINDER:
      return "reminder";
    case EmailLogType.BOOKING_CANCELLED:
      return "cancellation";
    case EmailLogType.BOOKING_RESCHEDULED:
      return "reschedule";
    case EmailLogType.VOUCHER_SENT:
      return "voucher";
    case EmailLogType.GENERIC:
      return "other";
  }
}

function getEmailTypeCategoryLabel(type: EmailLogType, templateKey: string): string {
  switch (getEmailTypeCategory(type, templateKey)) {
    case "booking_confirmation":
      return "Potvrzení rezervace";
    case "reminder":
      return "Reminder";
    case "cancellation":
      return "Zrušení";
    case "reschedule":
      return "Přesun termínu";
    case "voucher":
      return "Voucher";
    case "admin":
      return "Admin notifikace";
    case "other":
      return "Ostatní";
  }
}

function getEmailHealthState(input: {
  pending: number;
  retrying: number;
  processing: number;
  failed: number;
  latestError: string | null;
  lastSentLabel: string;
}) {
  if (input.failed > 0 || input.retrying > 0 || input.latestError) {
    return {
      tone: "error" as const,
      title: "Problém s odesíláním emailů",
      helper: "Některé zprávy selhaly nebo čekají na další pokus.",
      summary: `${input.failed} selhalo • ${input.retrying} je v retry • poslední odeslání ${input.lastSentLabel}`,
    };
  }

  if (input.pending > 0 || input.processing > 0) {
    return {
      tone: "warning" as const,
      title: "Některé emaily čekají na zpracování",
      helper: "Ve frontě jsou zprávy, které worker ještě nezpracoval.",
      summary: `${input.pending} čeká ve frontě • ${input.processing} se právě zpracovává • poslední odeslání ${input.lastSentLabel}`,
    };
  }

  return {
    tone: "ok" as const,
    title: "Emaily fungují správně",
    helper: "Fronta je prázdná a poslední odeslání proběhlo bez chyby.",
    summary: `Fronta je prázdná • poslední odeslání ${input.lastSentLabel}`,
  };
}

function getWorkerSummary({
  pending,
  retrying,
  processing,
  failed,
}: {
  pending: number;
  retrying: number;
  processing: number;
  failed: number;
}) {
  if (processing > 0) {
    return `Worker právě drží ${processing} ${processing === 1 ? "zprávu" : processing < 5 ? "zprávy" : "zpráv"} v claimu.`;
  }

  if (pending > 0 || retrying > 0) {
    return "Ve frontě jsou čekající zprávy, ale aktuálně není vidět aktivní claim workeru.";
  }

  if (failed > 0) {
    return "Fronta je prázdná, ale zůstávají selhané záznamy k dořešení nebo ručnímu retry.";
  }

  return "Fronta je čistá a worker momentálně nedrží žádný aktivní job.";
}

async function getEmailLogsData(): Promise<EmailLogsDashboardData> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const sevenDayStart = new Date(todayStart);
  sevenDayStart.setDate(sevenDayStart.getDate() - 6);
  const [
    pending,
    retrying,
    processing,
    sent,
    failed,
    todaySent,
    sevenDaySent,
    lastSentLog,
    latestErrorLog,
    recentLogs,
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
    prisma.emailLog.count({
      where: {
        status: EmailLogStatus.SENT,
        sentAt: { gte: todayStart, lt: tomorrowStart },
      },
    }),
    prisma.emailLog.count({
      where: {
        status: EmailLogStatus.SENT,
        sentAt: { gte: sevenDayStart, lt: tomorrowStart },
      },
    }),
    prisma.emailLog.findFirst({
      where: {
        status: EmailLogStatus.SENT,
        sentAt: { not: null },
      },
      orderBy: { sentAt: "desc" },
      select: {
        sentAt: true,
      },
    }),
    prisma.emailLog.findFirst({
      where: {
        errorMessage: { not: null },
        OR: [
          { status: EmailLogStatus.FAILED },
          {
            status: EmailLogStatus.PENDING,
            attemptCount: { gt: 0 },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        errorMessage: true,
      },
    }),
    prisma.emailLog.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 48,
      include: {
        booking: {
          select: {
            id: true,
            clientNameSnapshot: true,
            serviceNameSnapshot: true,
            scheduledStartsAt: true,
            scheduledEndsAt: true,
          },
        },
        client: {
          select: {
            fullName: true,
          },
        },
      },
    }),
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

  const lastSentLabel = formatDateTimeLabel(lastSentLog?.sentAt);
  const latestError = latestErrorLog?.errorMessage ?? null;
  const waitingCount = pending + retrying + processing;
  const health = getEmailHealthState({
    pending,
    retrying,
    processing,
    failed,
    latestError,
    lastSentLabel,
  });

  return {
    referenceNowIso: now.toISOString(),
    health: {
      ...health,
      latestError,
    },
    stats: [
      {
        label: "Dnes odesláno",
        value: String(todaySent),
        tone: "accent" as const,
        detail: "Úspěšně odeslané zprávy od dnešní půlnoci.",
      },
      {
        label: "Za posledních 7 dní",
        value: String(sevenDaySent),
        detail: "Součet úspěšně odeslaných zpráv za poslední týden.",
      },
      {
        label: "Čeká na odeslání",
        value: String(waitingCount),
        tone: waitingCount > 0 ? ("accent" as const) : ("muted" as const),
        detail: `${pending} ve frontě • ${retrying} retry • ${processing} se zpracovává`,
      },
      {
        label: "Selhalo",
        value: String(failed),
        tone: failed > 0 ? ("accent" as const) : ("muted" as const),
        detail: "Zprávy po vyčerpání retry nebo s neuzavřeným incidentem.",
      },
      {
        label: "Poslední odeslání",
        value: lastSentLabel,
        detail: sent > 0 ? "Poslední úspěšně uzavřený email log." : "Zatím neevidujeme žádné odeslání.",
      },
    ],
    recentEmails: recentLogs.map((log) => {
      const recipientName = log.booking?.clientNameSnapshot ?? log.client?.fullName ?? "Bez jména";
      const statusValue = getEmailRecentStatus(log.status, log.processingStartedAt, log.attemptCount);
      const bookingSummary = log.booking
        ? `${log.booking.clientNameSnapshot} • ${log.booking.serviceNameSnapshot} • ${formatDateTimeLabel(log.booking.scheduledStartsAt)} - ${formatTime.format(log.booking.scheduledEndsAt)}`
        : null;

      return {
        id: log.id,
        typeLabel: getEmailTypeCategoryLabel(log.type, log.templateKey),
        typeValue: getEmailTypeCategory(log.type, log.templateKey),
        statusLabel: getEmailRecentStatusLabel(log.status, log.processingStartedAt, log.attemptCount),
        statusValue,
        recipientLabel: recipientName === "Bez jména" ? log.recipientEmail : `${recipientName} • ${log.recipientEmail}`,
        recipientEmail: log.recipientEmail,
        bookingSummary,
        bookingHref: log.booking ? getAdminBookingHref("owner", log.booking.id) : null,
        createdAtIso: log.createdAt.toISOString(),
        createdAtLabel: formatDateTimeLabel(log.createdAt),
        sentAtLabel: formatDateTimeLabel(log.sentAt),
        activityLabel:
          log.status === EmailLogStatus.SENT && log.sentAt
            ? `Odesláno ${formatDateTimeLabel(log.sentAt)}`
            : `Vytvořeno ${formatDateTimeLabel(log.createdAt)}`,
        attemptCount: log.attemptCount,
        lastAttemptLabel: formatDateTimeLabel(log.sentAt ?? log.updatedAt),
        nextAttemptLabel: formatDateTimeLabel(log.nextAttemptAt),
        errorMessage: log.errorMessage,
        trackingOpenedLabel: "Připraveno",
        trackingClickedLabel: "Připraveno",
        detailHref: `/admin/email-logy/${log.id}`,
        canRetry: log.status !== EmailLogStatus.SENT && log.processingStartedAt === null,
      };
    }),
    queueStats: [
      {
        label: "Ve frontě",
        value: String(pending),
        tone: pending > 0 ? ("accent" as const) : ("muted" as const),
        detail: "První pokus čekající na další průchod workeru.",
      },
      {
        label: "Retry",
        value: String(retrying),
        tone: retrying > 0 ? ("accent" as const) : ("muted" as const),
        detail: "Zprávy s dočasnou chybou a plánovaným dalším pokusem.",
      },
      {
        label: "Zpracovává se",
        value: String(processing),
        tone: processing > 0 ? ("accent" as const) : ("muted" as const),
        detail: "Claimnuté joby, které worker právě drží.",
      },
      {
        label: "Celkem odesláno",
        value: String(sent),
        detail: "Auditní součet všech úspěšně doručených emailů.",
      },
    ],
    workerSummary: getWorkerSummary({
      pending,
      retrying,
      processing,
      failed,
    }),
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
  const finalStatus = getEmailDetailFinalStatus(
    emailLog.status,
    emailLog.sentAt,
    emailLog.processingStartedAt,
    emailLog.attemptCount,
    emailLog.nextAttemptAt,
    emailLog.updatedAt,
  );
  const bookingTitle = emailLog.booking?.serviceNameSnapshot ?? "Bez navázané rezervace";
  const bookingScheduleLabel = emailLog.booking
    ? formatTimeRange(emailLog.booking.scheduledStartsAt, emailLog.booking.scheduledEndsAt)
    : "Bez termínu rezervace";
  const clientName = emailLog.booking?.clientNameSnapshot ?? emailLog.client?.fullName ?? "Bez klientky";
  const lastAttemptLabel = formatDateTimeLabel(emailLog.sentAt ?? emailLog.updatedAt);

  return {
    id: emailLog.id,
    status: emailLog.status,
    statusLabel: statusLabel(emailLog.status),
    finalStatus: finalStatus.value,
    finalStatusLabel: finalStatus.label,
    finalStatusDetail: finalStatus.detail,
    statusNeedsAttention: finalStatus.needsAttention,
    type: emailLog.type,
    typeLabel: emailTypeLabel(emailLog.type),
    recipientEmail: emailLog.recipientEmail,
    subject: emailLog.subject,
    businessTitle: emailLog.subject,
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
    errorSummary: getErrorSummary(emailLog.errorMessage),
    payload: emailLog.payload,
    bookingSummary: emailLog.booking
      ? `${emailLog.booking.clientNameSnapshot} • ${emailLog.booking.serviceNameSnapshot} • ${bookingScheduleLabel}`
      : "Bez navázané rezervace",
    bookingHref: emailLog.booking ? getAdminBookingHref("owner", emailLog.booking.id) : null,
    bookingTitle,
    bookingScheduleLabel,
    clientName,
    clientSummary: emailLog.client
      ? `${emailLog.client.fullName} • ${emailLog.client.email ?? "Bez e-mailu"}${emailLog.client.phone ? ` • ${emailLog.client.phone}` : ""}`
      : "Bez navázaného klienta",
    actionTokenId: emailLog.actionToken?.id ?? null,
    actionTokenLabel: emailLog.actionToken ? actionTokenTypeLabel(emailLog.actionToken.type) : "Bez navázaného action tokenu",
    actionTokenSummary: emailLog.actionToken
      ? `${actionTokenTypeLabel(emailLog.actionToken.type)} • expirace ${formatDateTimeLabel(emailLog.actionToken.expiresAt)}${emailLog.actionToken.usedAt ? ` • použito ${formatDateTimeLabel(emailLog.actionToken.usedAt)}` : ""}${emailLog.actionToken.revokedAt ? ` • zrušeno ${formatDateTimeLabel(emailLog.actionToken.revokedAt)}` : ""}`
      : "Bez navázaného action tokenu",
    lastAttemptLabel,
    headerTimestampLabel: emailLog.sentAt ? formatDateTimeLabel(emailLog.sentAt) : lastAttemptLabel,
    headerTimestampTitle: emailLog.sentAt ? "Odesláno" : "Poslední pokus",
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
