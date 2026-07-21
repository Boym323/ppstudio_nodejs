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
  getAdminBookingHref,
  getBookingStatusLabel,
} from "@/features/admin/lib/admin-booking";
import {
  bookingListSearchParamsSchema,
  type BookingListSourceValue,
  type BookingListStatusValue,
  type BookingListViewValue,
} from "@/features/admin/lib/admin-booking-list-validation";
import {
  addDays,
  formatDateKey,
  getDayBounds,
} from "@/features/admin/lib/admin-slots/time";
import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";
import {
  buildClientPhoneHref,
  formatClientPhoneForDisplay,
} from "@/features/booking/lib/client-phone";
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

const defaultReservationLimit = 30;
const reservationLimitStep = 30;
const reservationLimitMax = 200;

const activeBookingStatuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;

function isActiveBookingStatus(status: BookingStatus) {
  return status === BookingStatus.PENDING || status === BookingStatus.CONFIRMED;
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
              value: String(adminUsers),
              detail: "Aktivní databázové přístupy do administrace.",
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
    view: BookingListViewValue;
    query: string;
    status: BookingListStatusValue;
    source: BookingListSourceValue;
    dateFrom: string;
    dateTo: string;
    limit: number;
    hasActiveFilters: boolean;
  };
  views: Array<{ key: BookingListViewValue; label: string; count: number; href: string; isActive: boolean }>;
  attention: { pendingCount: number; needsClosureCount: number; totalCount: number; href: string };
  summary: {
    totalCount: number;
    visibleCount: number;
    emptyState: "today" | "upcoming" | "attention" | "history" | "all";
    showMoreHref: string | null;
  };
  sections: Array<{
    key: string;
    label: string;
    detail: string;
    totalCount: number;
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
      primaryContactLabel: string | null;
      primaryContactHref: string | null;
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
    view: typeof searchParams?.view === "string" ? searchParams.view : undefined,
    stat: typeof searchParams?.stat === "string" ? searchParams.stat : undefined,
    dateFrom: typeof searchParams?.dateFrom === "string" ? searchParams.dateFrom : undefined,
    dateTo: typeof searchParams?.dateTo === "string" ? searchParams.dateTo : undefined,
    showPast: typeof searchParams?.showPast === "string" ? searchParams.showPast : undefined,
    limit: typeof searchParams?.limit === "string" ? searchParams.limit : undefined,
  });

  const defaults = {
    query: "",
    status: "all" as BookingListStatusValue,
    source: "all" as BookingListSourceValue,
    view: "today" as BookingListViewValue,
    dateFrom: "",
    dateTo: "",
    limit: defaultReservationLimit,
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
    view: parsed.data.view ?? legacyView(parsed.data.stat, parsed.data.showPast) ?? defaults.view,
    dateFrom: dateFrom <= dateTo || !dateFrom || !dateTo ? dateFrom : dateTo,
    dateTo: dateFrom <= dateTo || !dateFrom || !dateTo ? dateTo : dateFrom,
    limit: parsed.data.limit ?? defaults.limit,
  };
}

function legacyView(stat?: string, showPast?: string): BookingListViewValue | null {
  if (stat === "needs_closure" || stat === "pending") return "attention";
  if (stat === "upcoming" || stat === "confirmed") return "upcoming";
  if (stat === "completed" || stat === "cancelled" || showPast === "1") return "history";
  return null;
}


function parseDateFilterBoundary(value: string, endOfDay = false) {
  if (!value) {
    return null;
  }

  const { startsAt, endsAt } = getDayBounds(value);
  return endOfDay ? new Date(endsAt.getTime() - 1) : startsAt;
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

  if (dateFrom) {
    scheduledStartsAtFilter.gte = dateFrom;
  }

  if (dateTo) {
    scheduledStartsAtFilter.lte = dateTo;
  }

  if (scheduledStartsAtFilter.gte || scheduledStartsAtFilter.lte) {
    where.scheduledStartsAt = scheduledStartsAtFilter;
  }

  return where;
}

function startOfToday() {
  return getDayBounds(formatDateKey(new Date())).startsAt;
}

function startOfTomorrow(todayStart: Date) {
  return addDays(todayStart, 1);
}

function buildReservationsHref(
  currentPath: string,
  filters: Pick<ReservationsDashboardData["filters"], "view" | "query" | "status" | "source" | "dateFrom" | "dateTo">,
  next: Partial<ReservationsDashboardData["filters"]> = {},
) {
  const values = { ...filters, ...next };
  const params = new URLSearchParams();
  params.set("view", values.view);
  if (values.query) params.set("query", values.query);
  if (values.status !== "all") params.set("status", values.status);
  if (values.source !== "all") params.set("source", values.source);
  if (values.dateFrom) params.set("dateFrom", values.dateFrom);
  if (values.dateTo) params.set("dateTo", values.dateTo);
  if (next.limit && next.limit !== defaultReservationLimit) params.set("limit", String(next.limit));
  return `${currentPath}?${params.toString()}`;
}

function viewWhere(view: BookingListViewValue, todayStart: Date, tomorrowStart: Date, now: Date): Prisma.BookingWhereInput {
  switch (view) {
    case "today": return { scheduledStartsAt: { gte: todayStart, lt: tomorrowStart } };
    case "upcoming": return { status: { in: [...activeBookingStatuses] }, scheduledStartsAt: { gte: tomorrowStart } };
    case "attention": return { OR: [{ status: BookingStatus.PENDING }, { status: { in: [...activeBookingStatuses] }, scheduledEndsAt: { lt: now } }] };
    case "history": return { status: { in: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.NO_SHOW] } };
    case "all": return {};
  }
}

function reservationOrder(view: BookingListViewValue): Prisma.BookingOrderByWithRelationInput[] {
  return [{ scheduledStartsAt: view === "history" || view === "all" ? "desc" : "asc" }, { id: "asc" }];
}

function buildBookingContacts(booking: { clientPhoneSnapshot: string | null; clientEmailSnapshot: string }) {
  const phone = booking.clientPhoneSnapshot?.trim();
  if (phone) return { primaryContactLabel: formatClientPhoneForDisplay(phone), primaryContactHref: buildClientPhoneHref(phone) };
  const email = booking.clientEmailSnapshot.trim();
  return { primaryContactLabel: email || null, primaryContactHref: email ? `mailto:${email}` : null };
}

export async function getReservationsData(area: AdminArea, searchParams?: Record<string, string | string[] | undefined>): Promise<ReservationsDashboardData> {
  const now = new Date();
  const todayStart = startOfToday();
  const tomorrowStart = startOfTomorrow(todayStart);
  const filters = normalizeReservationsSearchParams(searchParams);
  const currentPath = area === "owner" ? "/admin/rezervace" : "/admin/provoz/rezervace";
  const detailWhere = buildReservationsWhere(filters);
  const activeWhere = viewWhere(filters.view, todayStart, tomorrowStart, now);
  const where: Prisma.BookingWhereInput = { AND: [detailWhere, activeWhere] };
  const viewKeys: BookingListViewValue[] = ["today", "upcoming", "attention", "history", "all"];
  const viewLabels: Record<BookingListViewValue, string> = { today: "Dnes", upcoming: "Nadcházející", attention: "Pozornost", history: "Historie", all: "Vše" };
  const [totalCount, bookings, pendingCount, needsClosureCount, bookingCatalog, ...viewCounts] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({ where, orderBy: reservationOrder(filters.view), take: Math.min(filters.limit, reservationLimitMax), include: { client: { select: { fullName: true } } } }),
    prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
    prisma.booking.count({ where: { status: { in: [...activeBookingStatuses] }, scheduledEndsAt: { lt: now } } }),
    getPublicBookingCatalog(),
    ...viewKeys.map((view) => prisma.booking.count({ where: viewWhere(view, todayStart, tomorrowStart, now) })),
  ]);
  const rows = bookings.map((booking) => {
    const contacts = buildBookingContacts(booking);
    return {
      id: booking.id, title: booking.client?.fullName ?? booking.clientNameSnapshot, serviceName: booking.serviceNameSnapshot,
      scheduledStartsAtIso: booking.scheduledStartsAt.toISOString(), scheduledDateLabel: formatDateLabel(booking.scheduledStartsAt),
      scheduledDateShortLabel: formatDaySectionLabel(booking.scheduledStartsAt, todayStart, tomorrowStart), scheduledTimeLabel: `${formatTime.format(booking.scheduledStartsAt)} - ${formatTime.format(booking.scheduledEndsAt)}`,
      status: booking.status, statusLabel: getBookingStatusLabel(booking.status), primaryContactLabel: contacts.primaryContactLabel,
      primaryContactHref: contacts.primaryContactHref, href: getAdminBookingHref(area, booking.id),
      availableActions: getAdminBookingActionOptions(booking.status, { scheduledEndsAt: booking.scheduledEndsAt }),
      isMuted: booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.CANCELLED,
      isPending: booking.status === BookingStatus.PENDING,
      needsClosure: booking.scheduledEndsAt < now && isActiveBookingStatus(booking.status),
    };
  });
  const sections = new Map<string, ReservationsDashboardData["sections"][number]>();
  for (const row of rows) {
    const attentionKey = row.needsClosure ? "needs_closure" : "pending";
    const key = filters.view === "attention" ? attentionKey : row.scheduledStartsAtIso.slice(0, 10);
    const label = filters.view === "attention" ? (attentionKey === "needs_closure" ? "K uzavření" : "Čeká na potvrzení") : formatDaySectionLabel(new Date(row.scheduledStartsAtIso), todayStart, tomorrowStart);
    const detail = filters.view === "attention" ? (attentionKey === "needs_closure" ? "Proběhlé aktivní rezervace." : "Rezervace vyžadující potvrzení.") : "";
    const section = sections.get(key) ?? { key, label, detail, totalCount: 0, items: [] };
    section.items.push(row); section.totalCount += 1; sections.set(key, section);
  }
  const baseFilters = { view: filters.view, query: filters.query, status: filters.status, source: filters.source, dateFrom: filters.dateFrom, dateTo: filters.dateTo };
  const attentionHref = buildReservationsHref(currentPath, baseFilters, { view: "attention" });
  const hasActiveFilters = Boolean(filters.query || filters.status !== "all" || filters.source !== "all" || filters.dateFrom || filters.dateTo);
  return {
    currentPath,
    filters: { ...baseFilters, limit: filters.limit, hasActiveFilters },
    views: viewKeys.map((key, index) => ({ key, label: viewLabels[key], count: viewCounts[index] ?? 0, href: buildReservationsHref(currentPath, baseFilters, { view: key }), isActive: key === filters.view })),
    attention: { pendingCount, needsClosureCount, totalCount: pendingCount + needsClosureCount, href: attentionHref },
    summary: { totalCount, visibleCount: rows.length, emptyState: filters.view, showMoreHref: totalCount > rows.length ? buildReservationsHref(currentPath, baseFilters, { limit: Math.min(filters.limit + reservationLimitStep, reservationLimitMax) }) : null },
    sections: Array.from(sections.values()),
    manualBooking: { services: bookingCatalog.services.map((service) => ({ id: service.id, categoryName: service.categoryName, name: service.name, durationMinutes: service.durationMinutes, cleanupBlockMinutes: service.cleanupBlockMinutes, priceFromCzk: service.priceFromCzk })), slots: bookingCatalog.slots, clients: [] },
  } satisfies ReservationsDashboardData;
}

function formatDaySectionLabel(value: Date, todayStart: Date, tomorrowStart: Date) {
  const key = formatDateKey(value);
  const label = new Intl.DateTimeFormat("cs-CZ", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Prague" }).format(value);
  if (key === formatDateKey(todayStart)) return `Dnes · ${label}`;
  if (key === formatDateKey(tomorrowStart)) return `Zítra · ${label}`;
  return label;
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
