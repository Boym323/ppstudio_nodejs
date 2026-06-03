import {
  BookingActionTokenType,
  AvailabilitySlotStatus,
  BookingSource,
  BookingStatus,
  EmailLogStatus,
  EmailLogType,
  Prisma,
} from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
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
import {
  addDays,
  formatDateKey,
  getDayBounds,
  resolveWeekStart,
} from "@/features/admin/lib/admin-slots/time";
import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";
import {
  buildClientPhoneHref,
  formatClientPhoneForDisplay,
} from "@/features/booking/lib/client-phone";
import { listBootstrapAdminUsers } from "@/lib/auth/session";
import { deriveTrackingState } from "@/lib/email/resend-webhooks";
import { prisma } from "@/lib/prisma";

const formatDate = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Europe/Prague",
});

const formatTime = new Intl.DateTimeFormat("cs-CZ", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

const activeBookingStatuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;

function isActiveBookingStatus(status: BookingStatus) {
  return status === BookingStatus.PENDING || status === BookingStatus.CONFIRMED;
}

function isClosedBookingStatus(status: BookingStatus) {
  return (
    status === BookingStatus.COMPLETED ||
    status === BookingStatus.CANCELLED ||
    status === BookingStatus.NO_SHOW
  );
}

const formatDateTime = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
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

function emailTypeLabel(type: EmailLogType, templateKey: string): string {
  if (templateKey === "booking-confirmation-v1") {
    return "Přijetí rezervace";
  }

  if (templateKey === "booking-approved-v1") {
    return "Potvrzení rezervace";
  }

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

export async function getAdminOverviewData(area: AdminArea) {
  const now = new Date();
  const { startsAt: todayStart, endsAt: tomorrowStart } = getDayBounds(formatDateKey(now));

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
      needsClosure: boolean;
    }>;
  }>;
  manualBooking: {
    services: Array<{
      id: string;
      categoryName: string;
      name: string;
      durationMinutes: number;
      cleanupBlockMinutes: number;
      priceFromCzk: number | null;
    }>;
    slots: Awaited<ReturnType<typeof getPublicBookingCatalog>>["slots"];
    clients: Array<{
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
      internalNote: string | null;
      isActive: boolean;
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

  if (filters.stat === "needs_closure") {
    where.scheduledEndsAt = { lt: new Date() };

    if (!statusFilter) {
      where.status = { in: [...activeBookingStatuses] };
    }
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

  if (!statusFilter && filters.stat && filters.stat !== "needs_closure" && filters.stat !== "upcoming") {
    const statStatus = bookingStatusFromFilter(filters.stat);

    if (statStatus) {
      where.status = statStatus;
    }
  }

  return where;
}

function startOfToday() {
  return getDayBounds(formatDateKey(new Date())).startsAt;
}

function startOfTomorrow(todayStart: Date) {
  return addDays(todayStart, 1);
}

function startOfWeek(todayStart: Date) {
  return resolveWeekStart(formatDateKey(todayStart));
}

function startOfNextWeek(weekStart: Date) {
  return addDays(weekStart, 7);
}

function formatGroupDateLabel(value: Date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: "Europe/Prague",
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
      primaryContactLabel: formatClientPhoneForDisplay(phone),
      primaryContactHref: buildClientPhoneHref(phone),
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
  const now = new Date();
  const tomorrowStart = startOfTomorrow(todayStart);
  const weekStart = startOfWeek(todayStart);
  const nextWeekStart = startOfNextWeek(weekStart);
  const filters = normalizeReservationsSearchParams(searchParams);
  const where = buildReservationsWhere(filters);
  const currentPath = area === "owner" ? "/admin/rezervace" : "/admin/provoz/rezervace";

  const [
    today,
    needsClosure,
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
        status: { in: [...activeBookingStatuses] },
      },
    }),
    prisma.booking.count({
      where: {
        scheduledEndsAt: { lt: now },
        status: { in: [...activeBookingStatuses] },
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
        isActive: true,
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
    const needsClosure = booking.scheduledEndsAt < now && isActiveBookingStatus(booking.status);

    if (needsClosure) {
      groupKey = "needs_closure";
      groupLabel = "K uzavření";
      groupDetail = "Proběhlé rezervace, které ještě nejsou označené jako hotové, zrušené nebo no-show.";
    } else if (booking.status === BookingStatus.PENDING) {
      groupKey = "pending";
      groupLabel = "Čeká na potvrzení";
      groupDetail = "Rezervace vyžadující rychlé provozní rozhodnutí.";
    } else if (
      startsAt < todayStart ||
      isClosedBookingStatus(booking.status)
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
      needsClosure,
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
  const groupOrder = ["needs_closure", "pending", "upcoming", "past"];

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
        key: "needs_closure",
        label: "K uzavření",
        value: String(needsClosure),
        tone: "accent" as const,
        href: buildReservationsStatHref(currentPath, filters, "needs_closure"),
        isActive: filters.stat === "needs_closure",
      },
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
        cleanupBlockMinutes: service.cleanupBlockMinutes,
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

export async function getManualBookingClientById(clientId: string) {
  const client = await prisma.client.findUnique({
    where: {
      id: clientId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      internalNote: true,
      isActive: true,
    },
  });

  if (!client) {
    return null;
  }

  return {
    ...client,
    email: client.email ?? "",
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
  | "booking_received"
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
    trackingStateLabel: string;
    trackingStateValue: "sent" | "pending" | "processing" | "retry" | "failed";
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
  clientContactEmail: string | null;
  canRefreshRecipientFromClient: boolean;
  canResend: boolean;
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

  if (templateKey === "booking-confirmation-v1") {
    return "booking_received";
  }

  if (templateKey === "booking-approved-v1") {
    return "booking_confirmation";
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
    case "booking_received":
      return "Přijetí rezervace";
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

export async function getEmailLogsData(): Promise<EmailLogsDashboardData> {
  const now = new Date();
  const { startsAt: todayStart, endsAt: tomorrowStart } = getDayBounds(formatDateKey(now));
  const sevenDayStart = addDays(todayStart, -6);
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
        ? `${log.booking.serviceNameSnapshot} • ${formatDateTimeLabel(log.booking.scheduledStartsAt)} - ${formatTime.format(log.booking.scheduledEndsAt)}`
        : null;

      const trackingState = deriveTrackingState({
        trackingLastEvent: log.trackingLastEvent,
        trackingClickedAt: log.trackingClickedAt,
        trackingOpenedAt: log.trackingOpenedAt,
        trackingDeliveredAt: log.trackingDeliveredAt,
        trackingBouncedAt: log.trackingBouncedAt,
        trackingComplainedAt: log.trackingComplainedAt,
        trackingFailedAt: log.trackingFailedAt,
        trackingSuppressedAt: log.trackingSuppressedAt,
      });

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
        trackingStateLabel: trackingState.label,
        trackingStateValue: trackingState.value,
        trackingOpenedLabel: log.trackingOpenedAt ? formatDateTimeLabel(log.trackingOpenedAt) : "Připraveno",
        trackingClickedLabel: log.trackingClickedAt ? formatDateTimeLabel(log.trackingClickedAt) : "Připraveno",
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
    typeLabel: emailTypeLabel(emailLog.type, emailLog.templateKey),
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
      ? `${emailLog.client.fullName} • ${emailLog.client.email ?? "Bez e-mailu"}${emailLog.client.phone ? ` • ${formatClientPhoneForDisplay(emailLog.client.phone)}` : ""}`
      : "Bez navázaného klienta",
    clientContactEmail: emailLog.client?.email ?? null,
    canRefreshRecipientFromClient: !isProcessing && !!(emailLog.client?.email ?? emailLog.booking?.clientEmailSnapshot),
    canResend: !isProcessing,
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
