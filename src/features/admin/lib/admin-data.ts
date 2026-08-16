import {
  BookingActionTokenType,
  AvailabilitySlotStatus,
  BookingSource,
  BookingStatus,
  BookingSubmissionOutcome,
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
import { getEmailDeliveryFailureWhere, getUnresolvedEmailDeliveryFailureWhere } from "@/lib/email/incidents";

export { getEmailDeliveryFailureWhere, getUnresolvedEmailDeliveryFailureWhere } from "@/lib/email/incidents";
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

type EmailTrackingInput = Parameters<typeof deriveTrackingState>[0];

export function getEmailDetailFinalStatus(input: {
  status: EmailLogStatus;
  sentAt: Date | null;
  processingStartedAt: Date | null;
  attemptCount: number;
  nextAttemptAt: Date | null;
  updatedAt: Date;
} & EmailTrackingInput): {
  value: "sent" | "pending" | "retry" | "failed";
  label: string;
  detail: string;
  needsAttention: boolean;
} {
  const tracking = deriveTrackingState(input);

  if (tracking.value === "failed") {
    return {
      value: "failed" as const,
      label: "Nedoručeno",
      detail: input.trackingBouncedAt
        ? "Odmítnuto cílovým serverem (bounce)"
        : tracking.label,
      needsAttention: true,
    };
  }

  if (tracking.value === "retry") {
    const isComplaint = input.trackingComplainedAt !== null;

    return {
      value: "retry" as const,
      label: isComplaint ? "Nahlášeno jako spam" : "Doručení vyžaduje pozornost",
      detail: tracking.label,
      needsAttention: true,
    };
  }

  if (input.sentAt) {
    return {
      value: "sent" as const,
      label: "Odesláno",
      detail: `Odeslání providerovi úspěšné ${formatDateTimeLabel(input.sentAt)}`,
      needsAttention: false,
    };
  }

  if (input.attemptCount > 0 && input.status !== EmailLogStatus.FAILED) {
    return {
      value: "retry" as const,
      label: "Retry",
      detail: input.processingStartedAt
        ? `Probíhá další pokus od ${formatDateTimeLabel(input.processingStartedAt)}`
        : `Další pokus ${formatDateTimeLabel(input.nextAttemptAt)}`,
      needsAttention: true,
    };
  }

  if (input.status === EmailLogStatus.FAILED) {
    return {
      value: "failed" as const,
      label: "Selhalo",
      detail: `Poslední pokus ${formatDateTimeLabel(input.processingStartedAt ?? input.updatedAt)}`,
      needsAttention: true,
    };
  }

  return {
    value: "pending" as const,
    label: "Čeká",
    detail: input.processingStartedAt
      ? `První pokus běží od ${formatDateTimeLabel(input.processingStartedAt)}`
      : `Ve frontě od ${formatDateTimeLabel(input.nextAttemptAt)}`,
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
      return "Notifikace nové rezervace";
    case EmailLogType.BOOKING_RECEIVED:
      return "Přijetí rezervace";
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
    prisma.emailLog.count({ where: getUnresolvedEmailDeliveryFailureWhere() }),
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
  const query = parsed.data.query ?? defaults.query;
  const requestedView = parsed.data.view ?? legacyView(parsed.data.stat, parsed.data.showPast) ?? defaults.view;

  return {
    // Hledání klientky je globální; záložka „Nadcházející“ nesmí schovat její starší rezervace.
    query,
    status: parsed.data.status ?? defaults.status,
    source: parsed.data.source ?? defaults.source,
    view: query ? "all" : requestedView,
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

export function getEmailLogSeverity(input: {
  status: EmailLogStatus;
  processingStartedAt: Date | null;
  attemptCount: number;
  staleBefore: Date;
} & EmailTrackingInput): AdminLogSeverity {
  const tracking = deriveTrackingState(input);

  if (tracking.value === "failed" || input.status === EmailLogStatus.FAILED) return "error";
  if (tracking.value === "retry") return "warning";
  if (input.processingStartedAt && input.processingStartedAt < input.staleBefore) return "warning";
  if (input.attemptCount > 0 && input.status === EmailLogStatus.PENDING) return "warning";
  return input.status === EmailLogStatus.SENT ? "success" : "info";
}

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
  transportStatusLabel: string;
  deliveryStatusLabel: string;
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
    case EmailLogType.BOOKING_RECEIVED:
      return "booking_received";
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
    prisma.emailLog.count({ where: getUnresolvedEmailDeliveryFailureWhere() }),
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
        OR: [
          getUnresolvedEmailDeliveryFailureWhere(),
          {
            status: EmailLogStatus.PENDING,
            attemptCount: { gt: 0 },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        errorMessage: true,
        trackingLastEvent: true,
        trackingClickedAt: true,
        trackingOpenedAt: true,
        trackingDeliveredAt: true,
        trackingBouncedAt: true,
        trackingComplainedAt: true,
        trackingFailedAt: true,
        trackingSuppressedAt: true,
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
      where: getUnresolvedEmailDeliveryFailureWhere(),
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        booking: { select: { clientNameSnapshot: true } },
      },
    }),
  ]);

  const lastSentLabel = formatDateTimeLabel(lastSentLog?.sentAt);
  const latestError = latestErrorLog
    ? latestErrorLog.errorMessage ?? deriveTrackingState(latestErrorLog).label
    : null;
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
        canRetry: log.status === EmailLogStatus.PENDING && log.processingStartedAt === null,
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
      meta: `${deriveTrackingState(log).value === "failed" ? "Nedoručeno" : statusLabel(log.status)} • ${formatDateTimeLabel(log.updatedAt)}`,
      description: `${log.type} • ${log.errorMessage ?? deriveTrackingState(log).label} • klientka ${log.booking?.clientNameSnapshot ?? "bez rezervace"}`,
      badge: "chyba",
      href: `/admin/email-logy/${log.id}`,
    })),
  };
}

export type AdminLogView = "attention" | "events" | "emails" | "system";
export type AdminLogSeverity = "info" | "success" | "warning" | "error";
export type AdminLogSource = "all" | "email" | "booking" | "voucher" | "service" | "settings" | "availability" | "admin" | "submission";

export type AdminLogItem = {
  id: string;
  occurredAt: string;
  category: "event" | "email" | "automation" | "system";
  severity: AdminLogSeverity;
  title: string;
  description: string | null;
  actorLabel: string | null;
  entityLabel: string | null;
  entityHref: string | null;
  sourceType: "email" | "booking" | "voucher" | "service" | "settings" | "availability" | "admin" | "submission";
  sourceId: string;
  primaryAction: "retry" | "release" | "detail" | "open" | null;
  emailLogId?: string;
  queueState?: string;
  trackingState?: string;
};

export type AdminLogsData = {
  area: AdminArea;
  view: AdminLogView;
  items: AdminLogItem[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  filters: { query: string; severity: "all" | AdminLogSeverity; source: AdminLogSource; emailType: "all" | EmailLogType; dateFrom: string; dateTo: string };
  attention: { failed: number; retry: number; stuck: number; critical: number };
  queueStats: EmailLogsDashboardData["queueStats"];
  workerSummary: string;
};

const adminLogPageSize = 50;
const workerLockTimeoutMs = 10 * 60 * 1000;

function bookingHistoryLabel(status: BookingStatus) {
  switch (status) {
    case BookingStatus.PENDING: return "Rezervace vytvořena";
    case BookingStatus.CONFIRMED: return "Rezervace potvrzena";
    case BookingStatus.CANCELLED: return "Rezervace zrušena";
    case BookingStatus.COMPLETED: return "Rezervace dokončena";
    case BookingStatus.NO_SHOW: return "Klientka nedorazila";
  }
}

function bookingHistorySeverity(status: BookingStatus): AdminLogSeverity {
  if (status === BookingStatus.NO_SHOW) return "warning";
  if (status === BookingStatus.COMPLETED || status === BookingStatus.CONFIRMED) return "success";
  return "info";
}

function bookingHistoryReasonLabel(reason: string | null) {
  const labels: Record<string, string> = {
    "public-booking-request-v1": "Rezervace odeslána z online formuláře",
    "owner-email-approve-v1": "Rezervace potvrzena z e-mailu",
    "owner-email-reject-v1": "Rezervace zamítnuta z e-mailu",
    "public-cancellation-flow-v1": "Rezervace zrušena klientkou online",
    "admin-manual-booking-v1": "Rezervace vytvořena ručně v administraci",
  };
  return reason ? labels[reason] ?? reason : null;
}

const adminSubmissionPrefixes = ["ADMIN_LOGIN_", "ADMIN_INVITE_ACTIVATION_", "ADMIN_RECOVERY_"] as const;
const publicVoucherSubmissionPrefix = "PUBLIC_VOUCHER_VERIFY_";
const expectedBookingFailureCodes = [
  "RATE_LIMITED",
  "VALIDATION_ERROR",
  "SERVICE_UNAVAILABLE",
  "SLOT_UNAVAILABLE",
  "SLOT_NOT_ALLOWED",
  "SLOT_TOO_SHORT",
  "SLOT_ALREADY_BOOKED_BY_CLIENT",
  "VOUCHER_INVALID",
  "BOOKING_CONFLICT",
] as const;
const criticalBookingFailureCodes = ["TEMPORARY_FAILURE", "SCHEMA_MISMATCH", "UNEXPECTED_ERROR"] as const;

export function isCriticalBookingSubmission(failureCode: string | null) {
  return criticalBookingFailureCodes.some((code) => code === failureCode)
    || (failureCode?.startsWith(publicVoucherSubmissionPrefix) === true && failureCode.endsWith("_UNKNOWN_ERROR"));
}

export function getBookingSubmissionPresentation(entry: {
  outcome: BookingSubmissionOutcome;
  failureCode: string | null;
}) {
  const { failureCode, outcome } = entry;
  if (failureCode?.startsWith("ADMIN_LOGIN_")) {
    return { title: "Přihlášení administrátora", severity: "info" as const, entityFallback: "Administrace", needsAttention: false };
  }
  if (failureCode?.startsWith("ADMIN_INVITE_ACTIVATION_")) {
    return { title: "Aktivace přístupu", severity: "info" as const, entityFallback: "Administrátorský přístup", needsAttention: false };
  }
  if (failureCode?.startsWith("ADMIN_RECOVERY_")) {
    return { title: "Obnova administrátora", severity: "info" as const, entityFallback: "Administrace", needsAttention: false };
  }
  if (failureCode?.startsWith(publicVoucherSubmissionPrefix)) {
    const needsAttention = isCriticalBookingSubmission(failureCode);
    return { title: "Veřejné ověření voucheru", severity: needsAttention ? "error" as const : "info" as const, entityFallback: "Voucher", needsAttention };
  }

  const expectedFailure = expectedBookingFailureCodes.some((code) => code === failureCode);
  const needsAttention = isCriticalBookingSubmission(failureCode);
  const severity: AdminLogSeverity = needsAttention || (outcome === BookingSubmissionOutcome.FAILED && !expectedFailure)
    ? "error"
    : outcome === BookingSubmissionOutcome.SUCCESS
      ? "success"
      : "info";
  const title = outcome === BookingSubmissionOutcome.SUCCESS
    ? "Rezervace úspěšně odeslána"
    : outcome === BookingSubmissionOutcome.BLOCKED
      ? "Odeslání rezervace zablokováno"
      : "Odeslání rezervace selhalo";
  return { title, severity, entityFallback: "Veřejný booking", needsAttention };
}

function criticalBookingSubmissionWhere(createdAt?: Prisma.DateTimeFilter): Prisma.BookingSubmissionLogWhereInput {
  return {
    outcome: BookingSubmissionOutcome.FAILED,
    ...(createdAt ? { createdAt } : {}),
    OR: [
      { failureCode: { in: [...criticalBookingFailureCodes] } },
      { failureCode: { startsWith: publicVoucherSubmissionPrefix, endsWith: "_UNKNOWN_ERROR" } },
    ],
  };
}

function parseLogDate(value: string | undefined, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function containsQuery(value: string): Prisma.StringFilter {
  return { contains: value, mode: "insensitive" };
}

export function buildEmailLogWhere(query: string, dateWhere?: Prisma.DateTimeFilter, emailType: "all" | EmailLogType = "all"): Prisma.EmailLogWhereInput {
  return {
    ...(dateWhere ? { createdAt: dateWhere } : {}),
    ...(emailType !== "all" ? { type: emailType } : {}),
    ...(query ? { OR: [
      { recipientEmail: containsQuery(query) }, { subject: containsQuery(query) },
      { templateKey: containsQuery(query) },
      { booking: { is: { OR: [{ clientNameSnapshot: containsQuery(query) }, { serviceNameSnapshot: containsQuery(query) }, { id: containsQuery(query) }] } } },
      { client: { is: { fullName: containsQuery(query) } } },
    ] } : {}),
  };
}

function getEmailDeliveryWarningWhere(): Prisma.EmailLogWhereInput {
  return {
    OR: [
      { trackingComplainedAt: { not: null } },
      {
        trackingLastEvent: "email.delivery_delayed",
        trackingDeliveredAt: null,
        trackingOpenedAt: null,
        trackingClickedAt: null,
      },
    ],
  };
}

export function buildBookingHistoryWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.BookingStatusHistoryWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { reason: containsQuery(query) }, { note: containsQuery(query) },
    { booking: { is: { OR: [{ id: containsQuery(query) }, { clientNameSnapshot: containsQuery(query) }, { serviceNameSnapshot: containsQuery(query) }] } } },
  ] } : {}) };
}

export function buildAvailabilityAuditWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.AvailabilityAuditEventWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { dateKey: containsQuery(query) }, { source: containsQuery(query) }, { operationId: containsQuery(query) },
    { actorUser: { is: { name: containsQuery(query) } } },
  ] } : {}) };
}

function availabilityAuditLabel(operation: string) {
  return ({ ADD: "Dostupnost přidána", REMOVE: "Dostupnost odebrána", CLEAR: "Dostupnost dne vyčištěna", COPY_WEEK: "Týden dostupnosti zkopírován", APPLY_TEMPLATE: "Použita šablona týdne", SYNC_DRAFT: "Publikován koncept týdne", UNDO: "Změna dostupnosti vrácena" } as Record<string, string>)[operation] ?? "Dostupnost upravena";
}

function availabilityAuditDescription(entry: { dateKey: string; before: Prisma.JsonValue; after: Prisma.JsonValue; revertedOperationId: string | null }) {
  const before = (entry.before as { intervals?: Array<{ startsAt: string; endsAt: string }> }).intervals ?? [];
  const after = (entry.after as { intervals?: Array<{ startsAt: string; endsAt: string }> }).intervals ?? [];
  const label = (intervals: Array<{ startsAt: string; endsAt: string }>) => intervals.map((item) => `${formatTime.format(new Date(item.startsAt))}–${formatTime.format(new Date(item.endsAt))}`).join(", ") || "bez dostupnosti";
  return `${entry.dateKey}: ${label(before)} → ${label(after)}${entry.revertedOperationId ? " • vrácení předchozí operace" : ""}`;
}

function buildRescheduleWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.BookingRescheduleLogWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { reason: containsQuery(query) }, { booking: { is: { OR: [{ id: containsQuery(query) }, { clientNameSnapshot: containsQuery(query) }, { serviceNameSnapshot: containsQuery(query) }] } } },
  ] } : {}) };
}

export function buildVoucherWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.VoucherWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { code: containsQuery(query) }, { purchaserName: containsQuery(query) }, { purchaserEmail: containsQuery(query) }, { recipientName: containsQuery(query) },
  ] } : {}) };
}

function buildVoucherRedemptionWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.VoucherRedemptionWhereInput {
  return { ...(dateWhere ? { redeemedAt: dateWhere } : {}), ...(query ? { OR: [
    { voucher: { is: { code: containsQuery(query) } } },
    { booking: { is: { OR: [{ id: containsQuery(query) }, { clientNameSnapshot: containsQuery(query) }] } } },
  ] } : {}) };
}

function buildVoucherChangeWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.VoucherChangeLogWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { voucher: { is: { code: containsQuery(query) } } },
    { actorUser: { is: { name: containsQuery(query) } } },
  ] } : {}) };
}

function buildServiceChangeWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.ServiceChangeLogWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { service: { is: { OR: [{ name: containsQuery(query) }, { publicName: containsQuery(query) }] } } },
    { actorUser: { is: { name: containsQuery(query) } } },
  ] } : {}) };
}

function buildSiteSettingsChangeWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.SiteSettingsChangeLogWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? {
    actorUser: { is: { name: containsQuery(query) } },
  } : {}) };
}

function buildAdminUserAuditWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.AdminUserAuditEventWhereInput {
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    { targetUser: { is: { OR: [{ name: containsQuery(query) }, { email: containsQuery(query) }] } } },
    { actorUser: { is: { name: containsQuery(query) } } },
  ] } : {}) };
}

function auditValueLabel(value: Prisma.JsonValue | undefined) {
  if (value === null || value === undefined) return "neuvedeno";
  if (typeof value === "boolean") return value ? "Ano" : "Ne";
  if (Array.isArray(value)) return value.join(", ") || "žádné";
  return String(value);
}

function categoryAuditValueLabel(value: Prisma.JsonValue | undefined, categoryNames: Map<string, string>) {
  if (typeof value === "string") return categoryNames.get(value) ?? value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return auditValueLabel(value);
  const snapshot = value as Record<string, Prisma.JsonValue>;
  if (typeof snapshot.categoryName === "string" && snapshot.categoryName) return snapshot.categoryName;
  if (typeof snapshot.categoryId === "string") return categoryNames.get(snapshot.categoryId) ?? snapshot.categoryId;
  return auditValueLabel(value);
}

function auditChangeDescription(
  beforeValue: Prisma.JsonValue,
  afterValue: Prisma.JsonValue,
  categoryNames = new Map<string, string>(),
) {
  const before = beforeValue && typeof beforeValue === "object" && !Array.isArray(beforeValue) ? beforeValue : {};
  const after = afterValue && typeof afterValue === "object" && !Array.isArray(afterValue) ? afterValue : {};
  const labels: Record<string, string> = {
    role: "Role", isActive: "Aktivní", validUntil: "Platnost do", status: "Stav",
    cancelledAt: "Zrušeno", hasInternalNote: "Interní poznámka", categoryId: "Kategorie",
    purchaserNameChanged: "Jméno kupujícího", purchaserEmailChanged: "E-mail kupujícího",
    internalNoteChanged: "Interní poznámka",
    name: "Název", publicName: "Veřejný název", seoTitle: "SEO titulek",
    durationMinutes: "Délka", cleanupMinutes: "Úklid", sortOrder: "Pořadí",
    isFeaturedOnHomepage: "Na homepage", homepageSortOrder: "Pořadí na homepage",
    isPubliclyBookable: "Rezervovatelná", publicContentFields: "Veřejný obsah",
    bookingMinAdvanceHours: "Minimální předstih", bookingMaxAdvanceDays: "Maximální předstih",
    bookingCancellationHours: "Storno lhůta", salonName: "Název salonu", addressLine: "Adresa",
    city: "Město", postalCode: "PSČ", phone: "Telefon", contactEmail: "Kontaktní e-mail",
    instagramUrl: "Instagram", voucherPdfLogoMediaId: "Logo voucheru",
    notificationAdminEmail: "Notifikační e-mail", emailSenderName: "Jméno odesílatele",
    emailSenderEmail: "E-mail odesílatele", hasEmailFooter: "Patička e-mailu",
  };
  return Object.keys(after).map((key) => {
    const label = labels[key] ?? key.replace(/Changed$/, "");
    if (key.endsWith("Changed") && after[key] === true) return `${label}: upraveno`;
    const suffix = key.endsWith("Minutes") ? " min" : key.endsWith("Hours") ? " h" : key.endsWith("Days") ? " dní" : "";
    const beforeLabel = key === "categoryId"
      ? categoryAuditValueLabel(before[key], categoryNames)
      : auditValueLabel(before[key]);
    const afterLabel = key === "categoryId"
      ? categoryAuditValueLabel(after[key], categoryNames)
      : auditValueLabel(after[key]);
    return `${label}: ${beforeLabel}${suffix} → ${afterLabel}${suffix}`;
  }).join(" • ");
}

export function buildBookingSubmissionWhere(query: string, dateWhere?: Prisma.DateTimeFilter): Prisma.BookingSubmissionLogWhereInput {
  const outcome = ["SUCCESS", "FAILED", "BLOCKED"].includes(query.toUpperCase())
    ? query.toUpperCase() as BookingSubmissionOutcome
    : undefined;
  return { ...(dateWhere ? { createdAt: dateWhere } : {}), ...(query ? { OR: [
    ...(outcome ? [{ outcome: { equals: outcome } }] : []),
    { failureCode: containsQuery(query) }, { failureReason: containsQuery(query) },
    { booking: { is: { OR: [{ id: containsQuery(query) }, { clientNameSnapshot: containsQuery(query) }, { serviceNameSnapshot: containsQuery(query) }] } } },
    { client: { is: { fullName: containsQuery(query) } } },
  ] } : {}) };
}

export function withBookingSubmissionSeverity(base: Prisma.BookingSubmissionLogWhereInput, severity: "all" | AdminLogSeverity) {
  if (severity === "all") return base;
  const adminScope: Prisma.BookingSubmissionLogWhereInput = {
    OR: adminSubmissionPrefixes.map((prefix) => ({ failureCode: { startsWith: prefix } })),
  };
  const voucherErrorScope: Prisma.BookingSubmissionLogWhereInput = {
    failureCode: { startsWith: publicVoucherSubmissionPrefix, endsWith: "_UNKNOWN_ERROR" },
  };
  const scopes: Record<AdminLogSeverity, Prisma.BookingSubmissionLogWhereInput> = {
    info: { OR: [
      adminScope,
      { failureCode: { startsWith: publicVoucherSubmissionPrefix, not: { endsWith: "_UNKNOWN_ERROR" } } },
      { outcome: BookingSubmissionOutcome.BLOCKED },
      { outcome: BookingSubmissionOutcome.FAILED, failureCode: { in: [...expectedBookingFailureCodes] } },
    ] },
    success: {
      outcome: BookingSubmissionOutcome.SUCCESS,
      OR: [
        { failureCode: null },
        { NOT: { OR: [...adminSubmissionPrefixes.map((prefix) => ({ failureCode: { startsWith: prefix } })), { failureCode: { startsWith: publicVoucherSubmissionPrefix } }] } },
      ],
    },
    warning: { id: "__no_match__" },
    error: { OR: [
      voucherErrorScope,
      {
        outcome: BookingSubmissionOutcome.FAILED,
        NOT: { OR: [adminScope, { failureCode: { startsWith: publicVoucherSubmissionPrefix } }, { failureCode: { in: [...expectedBookingFailureCodes] } }] },
      },
    ] },
  };
  return { AND: [base, scopes[severity]] } satisfies Prisma.BookingSubmissionLogWhereInput;
}

export function withEmailLogScope(
  base: Prisma.EmailLogWhereInput,
  view: AdminLogView,
  severity: "all" | AdminLogSeverity,
  staleBefore: Date,
): Prisma.EmailLogWhereInput {
  const deliveryFailure = getEmailDeliveryFailureWhere();
  const unresolvedDeliveryFailure = getUnresolvedEmailDeliveryFailureWhere();
  const deliveryWarning = getEmailDeliveryWarningWhere();
  const attention: Prisma.EmailLogWhereInput = { OR: [
    unresolvedDeliveryFailure,
    deliveryWarning,
    { status: EmailLogStatus.PENDING, attemptCount: { gt: 0 }, processingStartedAt: null },
    { status: EmailLogStatus.PENDING, processingStartedAt: { lt: staleBefore } },
  ] };
  const bySeverity: Record<AdminLogSeverity, Prisma.EmailLogWhereInput> = {
    error: view === "attention" ? unresolvedDeliveryFailure : deliveryFailure,
    success: { AND: [{ status: EmailLogStatus.SENT }, { NOT: [deliveryFailure, deliveryWarning] }] },
    warning: { AND: [{ NOT: [deliveryFailure] }, { OR: [
      deliveryWarning,
      { status: EmailLogStatus.PENDING, OR: [{ attemptCount: { gt: 0 } }, { processingStartedAt: { lt: staleBefore } }] },
    ] }] },
    info: { status: EmailLogStatus.PENDING, attemptCount: 0, OR: [{ processingStartedAt: null }, { processingStartedAt: { gte: staleBefore } }] },
  };
  const scopes = [base];
  if (view === "attention") scopes.push(attention);
  if (severity !== "all") scopes.push(bySeverity[severity]);
  return scopes.length === 1 ? base : { AND: scopes };
}

function withBookingHistorySeverity(base: Prisma.BookingStatusHistoryWhereInput, severity: "all" | AdminLogSeverity) {
  if (severity === "all") return base;
  const statuses: Record<AdminLogSeverity, BookingStatus[]> = {
    info: [BookingStatus.PENDING, BookingStatus.CANCELLED],
    success: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
    warning: [BookingStatus.NO_SHOW],
    error: [],
  };
  return { AND: [base, { status: { in: statuses[severity] } }] } satisfies Prisma.BookingStatusHistoryWhereInput;
}

export function normalizeAdminLogView(view: string | undefined, area: AdminArea): AdminLogView {
  const parsed: AdminLogView = ["attention", "events", "emails", "system"].includes(view ?? "")
    ? view as AdminLogView
    : "events";
  return area === "salon" && parsed === "system" ? "events" : parsed;
}

export function sortAndPageAdminLogItems(items: AdminLogItem[], page: number, pageSize = adminLogPageSize) {
  const sorted = [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
  const offset = (page - 1) * pageSize;
  return sorted.slice(offset, offset + pageSize);
}

export function getAdminLogPageMeta(total: number, requestedPage: number, pageSize = adminLogPageSize) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
  return { page, pageCount, rangeStart: total === 0 ? 0 : (page - 1) * pageSize + 1, rangeEnd: Math.min(page * pageSize, total) };
}

export function getAdminLogCandidatePlan(total: number, requestedPage: number, pageSize = adminLogPageSize) {
  const meta = getAdminLogPageMeta(total, requestedPage, pageSize);
  const offset = (meta.page - 1) * pageSize;
  return { ...meta, offset, take: offset + pageSize + 1 };
}

/** Sjednocuje omezené serverové kandidáty; historické tabulky se do klienta neposílají. */
export async function getAdminLogsData(input: {
  area: AdminArea;
  view?: string;
  query?: string;
  severity?: string;
  source?: string;
  emailType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
}): Promise<AdminLogsData> {
  const isOwner = input.area === "owner";
  const safeView = normalizeAdminLogView(input.view, input.area);
  const severity = ["info", "success", "warning", "error"].includes(input.severity ?? "")
    ? input.severity as AdminLogSeverity : "all";
  const source: AdminLogSource = ["email", "booking", "voucher", "service", "settings", "availability", "admin", "submission"].includes(input.source ?? "")
    ? input.source as AdminLogSource : "all";
  const emailType = Object.values(EmailLogType).includes(input.emailType as EmailLogType)
    ? input.emailType as EmailLogType : "all";
  const query = input.query?.trim().slice(0, 120) ?? "";
  const dateFrom = parseLogDate(input.dateFrom);
  const dateTo = parseLogDate(input.dateTo, true);
  const requestedPage = Number.parseInt(input.page ?? "1", 10);
  const now = new Date();
  const staleBefore = new Date(now.getTime() - workerLockTimeoutMs);
  const attentionSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dateWhere = dateFrom || dateTo ? { gte: dateFrom ?? undefined, lte: dateTo ?? undefined } : undefined;
  const emailActive = (safeView === "emails" || safeView === "attention") && (source === "all" || source === "email");
  const bookingActive = safeView === "events" && (source === "all" || source === "booking");
  const voucherActive = safeView === "events" && (source === "all" || source === "voucher");
  const serviceActive = safeView === "events" && (source === "all" || source === "service");
  const settingsActive = isOwner && safeView === "events" && (source === "all" || source === "settings");
  const availabilityActive = safeView === "events" && (source === "all" || source === "availability");
  const adminAuditActive = isOwner && safeView === "system" && (source === "all" || source === "admin");
  const submissionActive = (safeView === "system" || (isOwner && safeView === "attention")) && (source === "all" || source === "submission");
  const emailWhere = withEmailLogScope(buildEmailLogWhere(query, dateWhere, emailType), safeView, severity, staleBefore);
  const bookingHistoryWhere = withBookingHistorySeverity(buildBookingHistoryWhere(query, dateWhere), severity);
  const rescheduleWhere = severity === "all" || severity === "info" ? buildRescheduleWhere(query, dateWhere) : { id: "__no_match__" };
  const voucherWhere = severity === "all" || severity === "info" ? buildVoucherWhere(query, dateWhere) : { id: "__no_match__" };
  const redemptionWhere = severity === "all" || severity === "success" ? buildVoucherRedemptionWhere(query, dateWhere) : { id: "__no_match__" };
  const voucherChangeWhere = severity === "all" || severity === "info" ? buildVoucherChangeWhere(query, dateWhere) : { id: "__no_match__" };
  const serviceChangeWhere = severity === "all" || severity === "info" ? buildServiceChangeWhere(query, dateWhere) : { id: "__no_match__" };
  const siteSettingsChangeWhere = severity === "all" || severity === "info" ? buildSiteSettingsChangeWhere(query, dateWhere) : { id: "__no_match__" };
  const adminUserAuditWhere = severity === "all" || severity === "info" ? buildAdminUserAuditWhere(query, dateWhere) : { id: "__no_match__" };
  const submissionBaseWhere = buildBookingSubmissionWhere(query, dateWhere);
  const submissionWhere = safeView === "attention"
    ? severity === "all" || severity === "error"
      ? { AND: [submissionBaseWhere, criticalBookingSubmissionWhere({ gte: attentionSince })] }
      : { id: "__no_match__" }
    : withBookingSubmissionSeverity(submissionBaseWhere, severity);
  const availabilityWhere = severity === "all" || severity === "info" ? buildAvailabilityAuditWhere(query, dateWhere) : { id: "__no_match__" };

  const attentionHealthActive = safeView === "attention";
  const ownerQueueHealthActive = isOwner;
  const [failed, retry, stuck, pending, processing, critical, emailTotal, bookingHistoryTotal, rescheduleTotal, voucherTotal, redemptionTotal, voucherChangeTotal, serviceChangeTotal, siteSettingsChangeTotal, availabilityTotal, adminUserAuditTotal, submissionTotal] = await Promise.all([
    attentionHealthActive || ownerQueueHealthActive ? prisma.emailLog.count({ where: getUnresolvedEmailDeliveryFailureWhere() }) : Promise.resolve(0),
    attentionHealthActive || ownerQueueHealthActive ? prisma.emailLog.count({ where: { status: EmailLogStatus.PENDING, attemptCount: { gt: 0 }, processingStartedAt: null } }) : Promise.resolve(0),
    attentionHealthActive || ownerQueueHealthActive ? prisma.emailLog.count({ where: { status: EmailLogStatus.PENDING, processingStartedAt: { lt: staleBefore } } }) : Promise.resolve(0),
    ownerQueueHealthActive ? prisma.emailLog.count({ where: { status: EmailLogStatus.PENDING, attemptCount: 0, processingStartedAt: null } }) : Promise.resolve(0),
    ownerQueueHealthActive ? prisma.emailLog.count({ where: { status: EmailLogStatus.PENDING, processingStartedAt: { not: null } } }) : Promise.resolve(0),
    isOwner && safeView === "attention" ? prisma.bookingSubmissionLog.count({ where: criticalBookingSubmissionWhere({ gte: attentionSince }) }) : Promise.resolve(0),
    emailActive ? prisma.emailLog.count({ where: emailWhere }) : Promise.resolve(0),
    bookingActive ? prisma.bookingStatusHistory.count({ where: bookingHistoryWhere }) : Promise.resolve(0),
    bookingActive ? prisma.bookingRescheduleLog.count({ where: rescheduleWhere }) : Promise.resolve(0),
    voucherActive ? prisma.voucher.count({ where: voucherWhere }) : Promise.resolve(0),
    voucherActive ? prisma.voucherRedemption.count({ where: redemptionWhere }) : Promise.resolve(0),
    voucherActive ? prisma.voucherChangeLog.count({ where: voucherChangeWhere }) : Promise.resolve(0),
    serviceActive ? prisma.serviceChangeLog.count({ where: serviceChangeWhere }) : Promise.resolve(0),
    settingsActive ? prisma.siteSettingsChangeLog.count({ where: siteSettingsChangeWhere }) : Promise.resolve(0),
    availabilityActive ? prisma.availabilityAuditEvent.count({ where: availabilityWhere }) : Promise.resolve(0),
    adminAuditActive ? prisma.adminUserAuditEvent.count({ where: adminUserAuditWhere }) : Promise.resolve(0),
    submissionActive ? prisma.bookingSubmissionLog.count({ where: submissionWhere }) : Promise.resolve(0),
  ]);

  const total = emailTotal + bookingHistoryTotal + rescheduleTotal + voucherTotal + redemptionTotal
    + voucherChangeTotal + serviceChangeTotal + siteSettingsChangeTotal + availabilityTotal
    + adminUserAuditTotal + submissionTotal;
  const { page, pageCount, take } = getAdminLogCandidatePlan(total, requestedPage);
  // Totals a clamp vznikají před findMany, takže ručně zadaná hluboká stránka
  // nemůže nafouknout kandidátní množinu nad skutečnou poslední stránku.
  const [emails, bookingHistory, reschedules, vouchers, redemptions, voucherChanges, serviceChanges, siteSettingsChanges, availabilityAudits, adminUserAudits, submissions] = await Promise.all([
    emailActive ? prisma.emailLog.findMany({ where: emailWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, include: { booking: { select: { id: true, clientNameSnapshot: true, serviceNameSnapshot: true } }, client: { select: { fullName: true } }, resendRoot: { select: { incidentResolvedAt: true, incidentResolvedByEmailLogId: true } } } }) : Promise.resolve([]),
    bookingActive ? prisma.bookingStatusHistory.findMany({ where: bookingHistoryWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, include: { booking: { select: { id: true, clientNameSnapshot: true, serviceNameSnapshot: true } }, actorUser: { select: { name: true } } } }) : Promise.resolve([]),
    bookingActive ? prisma.bookingRescheduleLog.findMany({ where: rescheduleWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, include: { booking: { select: { id: true, clientNameSnapshot: true, serviceNameSnapshot: true } }, changedByUser: { select: { name: true } } } }) : Promise.resolve([]),
    voucherActive ? prisma.voucher.findMany({ where: voucherWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, select: { id: true, code: true, createdAt: true, createdByUser: { select: { name: true } } } }) : Promise.resolve([]),
    voucherActive ? prisma.voucherRedemption.findMany({ where: redemptionWhere, orderBy: [{ redeemedAt: "desc" }, { id: "desc" }], take, include: { voucher: { select: { id: true, code: true } }, redeemedByUser: { select: { name: true } } } }) : Promise.resolve([]),
    voucherActive ? prisma.voucherChangeLog.findMany({ where: voucherChangeWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, include: { voucher: { select: { id: true, code: true } }, actorUser: { select: { name: true } } } }) : Promise.resolve([]),
    serviceActive ? prisma.serviceChangeLog.findMany({ where: serviceChangeWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, include: { service: { select: { id: true, name: true, publicName: true } }, actorUser: { select: { name: true } } } }) : Promise.resolve([]),
    settingsActive ? prisma.siteSettingsChangeLog.findMany({ where: siteSettingsChangeWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, include: { actorUser: { select: { name: true } } } }) : Promise.resolve([]),
    availabilityActive ? prisma.availabilityAuditEvent.findMany({ where: availabilityWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, include: { actorUser: { select: { name: true } } } }) : Promise.resolve([]),
    adminAuditActive ? prisma.adminUserAuditEvent.findMany({ where: adminUserAuditWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, include: { targetUser: { select: { name: true } }, actorUser: { select: { name: true } } } }) : Promise.resolve([]),
    submissionActive ? prisma.bookingSubmissionLog.findMany({ where: submissionWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, include: { booking: { select: { id: true, clientNameSnapshot: true, serviceNameSnapshot: true } }, client: { select: { fullName: true } } } }) : Promise.resolve([]),
  ]);
  const categoryIds = serviceChanges.flatMap((entry) => [entry.before, entry.after]
    .map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const categoryValue = value.categoryId;
      if (typeof categoryValue === "string") return categoryValue;
      if (categoryValue && typeof categoryValue === "object" && !Array.isArray(categoryValue) && typeof categoryValue.categoryId === "string") return categoryValue.categoryId;
      return null;
    })
    .filter((id): id is string => id !== null));
  const categoryNames = new Map((categoryIds.length > 0
    ? await prisma.serviceCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
    : [])
    .map((category) => [category.id, category.name]));

  const bookingHref = (id: string) => getAdminBookingHref(input.area, id);
  const voucherHref = (id: string) => `${input.area === "owner" ? "/admin" : "/admin/provoz"}/vouchery/${id}`;
  const items: AdminLogItem[] = [
    ...emails.map((log) => {
      const tracking = deriveTrackingState(log);
      const logSeverity = getEmailLogSeverity({ ...log, staleBefore });
      const status = getEmailRecentStatus(log.status, log.processingStartedAt, log.attemptCount);
      const isStuck = log.processingStartedAt !== null && log.processingStartedAt < staleBefore;
      const primaryAction: AdminLogItem["primaryAction"] = isOwner
        ? (isStuck ? "release" : status === "failed" || status === "retry" ? "retry" : "detail")
        : null;
      const incidentResolved = log.resendRoot?.incidentResolvedAt ?? log.incidentResolvedAt;
      return { id: `email:${log.id}`, occurredAt: log.createdAt.toISOString(), category: "email" as const, severity: logSeverity, title: log.subject, description: `${log.recipientEmail}${tracking.value !== "pending" ? ` • ${tracking.label}` : ""}${incidentResolved && tracking.value === "failed" ? " • Vyřešeno následným odesláním" : ""}${log.errorMessage ? ` • ${getErrorSummary(log.errorMessage)}` : ""}`, actorLabel: null, entityLabel: log.booking ? `${log.booking.clientNameSnapshot} • ${log.booking.serviceNameSnapshot}` : log.client?.fullName ?? null, entityHref: log.booking ? bookingHref(log.booking.id) : null, sourceType: "email" as const, sourceId: log.id, primaryAction, emailLogId: log.id, queueState: getEmailRecentStatusLabel(log.status, log.processingStartedAt, log.attemptCount), trackingState: tracking.label };
    }),
    ...bookingHistory.map((entry) => ({ id: `booking-history:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: bookingHistorySeverity(entry.status), title: bookingHistoryLabel(entry.status), description: bookingHistoryReasonLabel(entry.reason) ?? entry.note, actorLabel: entry.actorUser?.name ?? (entry.actorType === "CLIENT" ? "Klientka" : entry.actorType === "SYSTEM" ? "Systém" : null), entityLabel: entry.booking ? `${entry.booking.clientNameSnapshot} • ${entry.booking.serviceNameSnapshot}` : "Odstraněná rezervace", entityHref: entry.booking ? bookingHref(entry.booking.id) : null, sourceType: "booking" as const, sourceId: entry.id, primaryAction: entry.booking ? "open" as const : null })),
    ...reschedules.map((entry) => ({ id: `booking-reschedule:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: "Rezervace přesunuta", description: entry.reason, actorLabel: entry.changedByUser?.name ?? (entry.changedByClient ? "Klientka" : null), entityLabel: entry.booking ? `${entry.booking.clientNameSnapshot} • ${entry.booking.serviceNameSnapshot}` : "Odstraněná rezervace", entityHref: entry.booking ? bookingHref(entry.booking.id) : null, sourceType: "booking" as const, sourceId: entry.id, primaryAction: entry.booking ? "open" as const : null })),
    ...vouchers.map((voucher) => ({ id: `voucher:${voucher.id}`, occurredAt: voucher.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: "Voucher vytvořen", description: null, actorLabel: voucher.createdByUser?.name ?? null, entityLabel: `Voucher ${voucher.code}`, entityHref: voucherHref(voucher.id), sourceType: "voucher" as const, sourceId: voucher.id, primaryAction: "open" as const })),
    ...redemptions.map((redemption) => ({ id: `voucher-redemption:${redemption.id}`, occurredAt: redemption.redeemedAt.toISOString(), category: "event" as const, severity: "success" as const, title: "Voucher uplatněn", description: null, actorLabel: redemption.redeemedByUser?.name ?? null, entityLabel: redemption.voucher ? `Voucher ${redemption.voucher.code}` : "Odstraněný voucher", entityHref: redemption.voucher ? voucherHref(redemption.voucher.id) : null, sourceType: "voucher" as const, sourceId: redemption.id, primaryAction: redemption.voucher ? "open" as const : null })),
    ...voucherChanges.map((entry) => ({ id: `voucher-change:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: entry.operation === "CANCEL" ? "Voucher zrušen" : "Voucher upraven", description: auditChangeDescription(entry.before, entry.after), actorLabel: entry.actorUser.name, entityLabel: `Voucher ${entry.voucher.code}`, entityHref: voucherHref(entry.voucher.id), sourceType: "voucher" as const, sourceId: entry.id, primaryAction: "open" as const })),
    ...serviceChanges.map((entry) => ({ id: `service-change:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: "Služba upravena", description: auditChangeDescription(entry.before, entry.after, categoryNames), actorLabel: entry.actorUser.name, entityLabel: entry.service.publicName ?? entry.service.name, entityHref: `${input.area === "owner" ? "/admin" : "/admin/provoz"}/sluzby?serviceId=${entry.service.id}`, sourceType: "service" as const, sourceId: entry.id, primaryAction: "open" as const })),
    ...siteSettingsChanges.map((entry) => ({ id: `settings-change:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: entry.operation === "UPDATE_BOOKING_POLICY" ? "Pravidla rezervace upravena" : entry.operation === "UPDATE_SALON" ? "Údaje salonu upraveny" : "E-mailová nastavení upravena", description: auditChangeDescription(entry.before, entry.after), actorLabel: entry.actorUser.name, entityLabel: "Nastavení webu", entityHref: "/admin/nastaveni", sourceType: "settings" as const, sourceId: entry.id, primaryAction: "open" as const })),
    ...availabilityAudits.map((entry) => ({ id: `availability:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "event" as const, severity: "info" as const, title: availabilityAuditLabel(entry.operation), description: availabilityAuditDescription(entry), actorLabel: entry.actorUser?.name ?? null, entityLabel: `Volné termíny • ${entry.dateKey}`, entityHref: `${input.area === "owner" ? "/admin" : "/admin/provoz"}/volne-terminy?week=${entry.dateKey}&day=${entry.dateKey}`, sourceType: "availability" as const, sourceId: entry.id, primaryAction: "open" as const })),
    ...adminUserAudits.map((entry) => ({ id: `admin-user-audit:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "system" as const, severity: "info" as const, title: ({ CREATE: "Admin účet vytvořen", UPDATE_PROFILE: "Admin účet upraven", CHANGE_ROLE: "Role admina změněna", ACTIVATE: "Admin účet aktivován", DEACTIVATE: "Admin účet deaktivován", INVITE_RESEND: "Pozvánka znovu vydána" } as Record<string, string>)[entry.operation] ?? "Admin účet upraven", description: auditChangeDescription(entry.before, entry.after), actorLabel: entry.actorUser.name, entityLabel: entry.targetUser.name, entityHref: "/admin/uzivatele", sourceType: "admin" as const, sourceId: entry.id, primaryAction: "open" as const })),
    ...submissions.map((entry) => {
      const presentation = getBookingSubmissionPresentation(entry);
      return { id: `submission:${entry.id}`, occurredAt: entry.createdAt.toISOString(), category: "system" as const, severity: presentation.severity, title: presentation.title, description: entry.failureReason ?? entry.failureCode, actorLabel: "Systém", entityLabel: entry.booking ? `${entry.booking.clientNameSnapshot} • ${entry.booking.serviceNameSnapshot}` : entry.client?.fullName ?? presentation.entityFallback, entityHref: entry.booking ? bookingHref(entry.booking.id) : null, sourceType: "submission" as const, sourceId: entry.id, primaryAction: entry.booking ? "open" as const : null };
    }),
  ];
  const visible = items.filter((item) => {
    if (safeView === "attention" && item.severity !== "error" && !(item.sourceType === "email" && item.severity === "warning")) return false;
    if (safeView === "events" && item.category !== "event") return false;
    if (safeView === "emails" && item.category !== "email") return false;
    if (severity !== "all" && item.severity !== severity) return false;
    if (source !== "all" && item.sourceType !== source) return false;
    return true;
  });
  return { area: input.area, view: safeView, items: sortAndPageAdminLogItems(visible, page), total, page, pageCount, pageSize: adminLogPageSize, filters: { query, severity, source, emailType, dateFrom: input.dateFrom ?? "", dateTo: input.dateTo ?? "" }, attention: { failed, retry, stuck, critical }, queueStats: [{ label: "Čeká", value: String(pending), tone: pending ? "accent" : "muted" }, { label: "Retry", value: String(retry), tone: retry ? "accent" : "muted" }, { label: "Zpracovává se", value: String(processing), tone: processing ? "accent" : "muted" }, { label: "Selhalo", value: String(failed), tone: failed ? "accent" : "muted" }], workerSummary: getWorkerSummary({ pending, retrying: retry, processing, failed }) };
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
  const finalStatus = getEmailDetailFinalStatus(emailLog);
  const tracking = deriveTrackingState(emailLog);
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
    canRetry: emailLog.status === EmailLogStatus.PENDING && !isProcessing,
    canRelease: isProcessing && emailLog.status === EmailLogStatus.PENDING,
    nextAttemptLabel: formatDateTimeLabel(emailLog.nextAttemptAt),
    processingStartedLabel: formatDateTimeLabel(emailLog.processingStartedAt),
    sentAtLabel: formatDateTimeLabel(emailLog.sentAt),
    createdAtLabel: formatDateTimeLabel(emailLog.createdAt),
    updatedAtLabel: formatDateTimeLabel(emailLog.updatedAt),
    providerLabel: emailLog.provider ?? "Bez providera",
    providerMessageIdLabel: emailLog.providerMessageId ?? "Bez message id",
    transportStatusLabel: emailLog.status === EmailLogStatus.SENT ? "Úspěšné" : statusLabel(emailLog.status),
    deliveryStatusLabel: tracking.value === "pending" && emailLog.status === EmailLogStatus.SENT
      ? "Bez potvrzení od providera"
      : tracking.value === "failed" ? finalStatus.detail : tracking.label,
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
