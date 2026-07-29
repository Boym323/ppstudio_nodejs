import { BookingStatus, Prisma } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  clientListSearchParamsSchema,
  normalizeClientListPage,
  type ClientListQuickFilterValue,
  type ClientListSortValue,
  type ClientListViewValue,
} from "@/features/admin/lib/admin-client-validation";
import {
  getAdminBookingHref,
  getBookingSourceLabel,
  getBookingStatusLabel,
} from "@/features/admin/lib/admin-booking";
import {
  getClientCrmSummary,
  type ClientCrmSummary,
} from "@/features/clients/lib/client-crm-summary";
import {
  buildClientPhoneHref,
  formatClientPhoneForDisplay,
} from "@/features/booking/lib/client-phone";
import { getWeeksWithoutVisit } from "@/features/admin/lib/kpi-retention";
import { prisma } from "@/lib/prisma";

const formatDate = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "Europe/Prague",
});

const formatDateTime = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

const clientPageSize = 50;

export type AdminClientsListItem = {
  id: string;
  href: string;
  fullName: string;
  email: string;
  emailHref: string | null;
  phoneDisplay: string;
  phoneHref: string | null;
  isActive: boolean;
  totalBookings: number;
  lastVisitLabel: string;
  lastServiceName: string | null;
  weeksWithoutVisit: number | null;
  nextBookingLabel: string;
  hasNote: boolean;
  isTestRecord: boolean;
};

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

function formatBookingDateLabel(startsAt: Date, endsAt: Date) {
  return `${formatDateTimeLabel(startsAt)} - ${new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(endsAt)}`;
}

function normalizeSearchParams(searchParams?: Record<string, string | string[] | undefined>) {
  const parsed = clientListSearchParamsSchema.safeParse({
    query: typeof searchParams?.query === "string" ? searchParams.query : undefined,
    view: typeof searchParams?.view === "string" ? searchParams.view : undefined,
    status: typeof searchParams?.status === "string" ? searchParams.status : undefined,
    sort: typeof searchParams?.sort === "string" ? searchParams.sort : undefined,
    quick: typeof searchParams?.quick === "string" ? searchParams.quick : undefined,
    retention: typeof searchParams?.retention === "string" ? searchParams.retention : undefined,
    retentionAt: typeof searchParams?.retentionAt === "string" ? searchParams.retentionAt : undefined,
    page: typeof searchParams?.page === "string" ? searchParams.page : undefined,
  });

  const defaults = {
    query: "",
    view: "all" as ClientListViewValue,
    sort: "recent" as ClientListSortValue,
    quick: "all" as ClientListQuickFilterValue,
    retention: undefined as "8_11" | "12_15" | "16_plus" | undefined,
    retentionAt: undefined as string | undefined,
    page: 1,
  };

  if (!parsed.success) {
    return defaults;
  }

  return {
    query: parsed.data.query ?? defaults.query,
    view: (() => {
      if (parsed.data.view) return parsed.data.view;
      if (parsed.data.retention) return "outreach";
      if (parsed.data.status === "inactive") return "inactive";
      if (parsed.data.quick === "no_contact") return "no_contact";
      if (parsed.data.quick === "new_30") return "new";
      return "all";
    })(),
    sort: parsed.data.sort ?? defaults.sort,
    quick: ["upcoming", "outreach", "new"].includes(parsed.data.view ?? (parsed.data.retention ? "outreach" : ""))
      ? "all"
      : (parsed.data.quick === "no_contact" || parsed.data.quick === "new_30" ? "all" : parsed.data.quick ?? defaults.quick),
    retention: (parsed.data.view ?? (parsed.data.retention ? "outreach" : "all")) === "outreach" ? parsed.data.retention : undefined,
    retentionAt: (parsed.data.view ?? (parsed.data.retention ? "outreach" : "all")) === "outreach" ? parsed.data.retentionAt : undefined,
    page: normalizeClientListPage(parsed.data.page),
  };
}

function hasInternalNoteWhere(): Prisma.ClientWhereInput {
  return {
    AND: [
      {
        internalNote: {
          not: null,
        },
      },
      {
        internalNote: {
          not: "",
        },
      },
    ],
  };
}

function hasNoContactWhere(): Prisma.ClientWhereInput {
  return {
    AND: [
      {
        OR: [{ email: null }, { email: "" }],
      },
      {
        OR: [{ phone: null }, { phone: "" }],
      },
    ],
  };
}

function buildClientWhere(
  filters: ReturnType<typeof normalizeSearchParams>,
  recentThreshold: Date,
  now: Date,
): Prisma.ClientWhereInput {
  const where: Prisma.ClientWhereInput = {};
  const andFilters: Prisma.ClientWhereInput[] = [];

  where.isActive = filters.view === "inactive" ? false : true;

  if (filters.query) {
    where.OR = [
      { fullName: { contains: filters.query, mode: "insensitive" } },
      { email: { contains: filters.query, mode: "insensitive" } },
      { phone: { contains: filters.query, mode: "insensitive" } },
      { internalNote: { contains: filters.query, mode: "insensitive" } },
    ];
  }

  if (filters.view === "upcoming") {
    andFilters.push({ bookings: { some: { status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] }, scheduledStartsAt: { gte: now } } } });
  }
  if (filters.view === "new") andFilters.push({ createdAt: { gte: recentThreshold } });
  if (filters.view === "no_contact") andFilters.push(hasNoContactWhere());
  if (filters.view === "outreach") {
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 86_400_000);
    andFilters.push(
      { bookings: { some: { status: BookingStatus.COMPLETED, scheduledStartsAt: { lt: eightWeeksAgo } } } },
      { bookings: { none: { status: BookingStatus.COMPLETED, scheduledStartsAt: { gte: eightWeeksAgo, lt: now } } } },
      { bookings: { none: { status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] }, scheduledStartsAt: { gte: now } } } },
    );
  }

  switch (filters.quick) {
    case "with_booking":
      andFilters.push({
        bookings: {
          some: {},
        },
      });
      break;
    case "without_booking":
      andFilters.push({
        bookings: {
          none: {},
        },
      });
      break;
    case "noted":
      andFilters.push(hasInternalNoteWhere());
      break;
    case "all":
    default:
      break;
  }

  if (filters.view === "outreach" && filters.retention) {
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 86_400_000);
    const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 86_400_000);
    const sixteenWeeksAgo = new Date(now.getTime() - 16 * 7 * 86_400_000);
    const lowerBound = filters.retention === "8_11" ? twelveWeeksAgo : filters.retention === "12_15" ? sixteenWeeksAgo : undefined;
    const upperBound = filters.retention === "8_11" ? eightWeeksAgo : filters.retention === "12_15" ? twelveWeeksAgo : sixteenWeeksAgo;
    andFilters.push(
      { isActive: true },
      { bookings: { some: { status: BookingStatus.COMPLETED, scheduledStartsAt: { lt: upperBound, ...(lowerBound ? { gte: lowerBound } : {}) } } } },
      { bookings: { none: { status: BookingStatus.COMPLETED, scheduledStartsAt: { gte: upperBound, lt: now } } } },
    );
  }

  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  return where;
}

function buildClientOrderBy(sort: Extract<ClientListSortValue, "name" | "created">): Prisma.ClientOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ fullName: "asc" }, { id: "asc" }];
    case "created":
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

function buildClientSqlWhere(
  filters: ReturnType<typeof normalizeSearchParams>,
  recentThreshold: Date,
  retentionReference: Date,
) {
  const clauses: Prisma.Sql[] = [];

  clauses.push(Prisma.sql`c."isActive" = ${filters.view !== "inactive"}`);
  if (filters.query) {
    const query = `%${filters.query}%`;
    clauses.push(Prisma.sql`(c."fullName" ILIKE ${query} OR c.email ILIKE ${query} OR c.phone ILIKE ${query} OR c."internalNote" ILIKE ${query})`);
  }

  if (filters.view === "upcoming") {
    clauses.push(Prisma.sql`EXISTS (SELECT 1 FROM "Booking" b WHERE b."clientId" = c.id AND b.status IN (${BookingStatus.PENDING}, ${BookingStatus.CONFIRMED}) AND b."scheduledStartsAt" >= ${retentionReference})`);
  }
  if (filters.view === "new") clauses.push(Prisma.sql`c."createdAt" >= ${recentThreshold}`);
  if (filters.view === "no_contact") clauses.push(Prisma.sql`(c.email IS NULL OR c.email = '') AND (c.phone IS NULL OR c.phone = '')`);
  if (filters.view === "outreach") {
    const eightWeeksAgo = new Date(retentionReference.getTime() - 8 * 7 * 86_400_000);
    clauses.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "Booking" b WHERE b."clientId" = c.id AND b.status = ${BookingStatus.COMPLETED} AND b."scheduledStartsAt" < ${eightWeeksAgo})`,
      Prisma.sql`NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."clientId" = c.id AND b.status = ${BookingStatus.COMPLETED} AND b."scheduledStartsAt" >= ${eightWeeksAgo} AND b."scheduledStartsAt" < ${retentionReference})`,
      Prisma.sql`NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."clientId" = c.id AND b.status IN (${BookingStatus.PENDING}, ${BookingStatus.CONFIRMED}) AND b."scheduledStartsAt" >= ${retentionReference})`,
    );
  }

  switch (filters.quick) {
    case "with_booking":
      clauses.push(Prisma.sql`EXISTS (SELECT 1 FROM "Booking" b WHERE b."clientId" = c.id)`);
      break;
    case "without_booking":
      clauses.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."clientId" = c.id)`);
      break;
    case "noted":
      clauses.push(Prisma.sql`c."internalNote" IS NOT NULL AND c."internalNote" <> ''`);
      break;
  }

  if (filters.view === "outreach" && filters.retention) {
    const eightWeeksAgo = new Date(retentionReference.getTime() - 8 * 7 * 86_400_000);
    const twelveWeeksAgo = new Date(retentionReference.getTime() - 12 * 7 * 86_400_000);
    const sixteenWeeksAgo = new Date(retentionReference.getTime() - 16 * 7 * 86_400_000);
    const lowerBound = filters.retention === "8_11" ? twelveWeeksAgo : filters.retention === "12_15" ? sixteenWeeksAgo : undefined;
    const upperBound = filters.retention === "8_11" ? eightWeeksAgo : filters.retention === "12_15" ? twelveWeeksAgo : sixteenWeeksAgo;
    clauses.push(
      Prisma.sql`c."isActive" = true`,
      Prisma.sql`EXISTS (SELECT 1 FROM "Booking" b WHERE b."clientId" = c.id AND b.status = ${BookingStatus.COMPLETED} AND b."scheduledStartsAt" < ${upperBound}${lowerBound ? Prisma.sql` AND b."scheduledStartsAt" >= ${lowerBound}` : Prisma.empty})`,
      Prisma.sql`NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."clientId" = c.id AND b.status = ${BookingStatus.COMPLETED} AND b."scheduledStartsAt" >= ${upperBound} AND b."scheduledStartsAt" < ${retentionReference})`,
    );
  }

  return clauses.length > 0 ? Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}` : Prisma.empty;
}

async function getOrderedClientPageIds(
  filters: ReturnType<typeof normalizeSearchParams>,
  where: Prisma.ClientWhereInput,
  recentThreshold: Date,
  retentionReference: Date,
  page: number,
) {
  const skip = (page - 1) * clientPageSize;

  if ((filters.view === "all" || filters.view === "no_contact" || filters.view === "inactive") && (filters.sort === "name" || filters.sort === "created")) {
    const clients = await prisma.client.findMany({
      where,
      orderBy: buildClientOrderBy(filters.sort),
      skip,
      take: clientPageSize,
      select: { id: true },
    });
    return clients.map((client) => client.id);
  }

  const sqlWhere = buildClientSqlWhere(filters, recentThreshold, retentionReference);
  const orderBy = filters.view === "upcoming"
    ? Prisma.sql`next_booking."nextBookingAt" ASC, c."fullName" ASC, c.id ASC`
    : filters.view === "outreach"
      ? Prisma.sql`last_visit."lastVisitAt" DESC, c.id ASC`
      : filters.view === "new"
        ? Prisma.sql`c."createdAt" DESC, c.id DESC`
        : filters.sort === "recent"
          ? Prisma.sql`last_visit."lastVisitAt" DESC NULLS LAST, c."createdAt" DESC, c.id DESC`
          : Prisma.sql`booking_count.total DESC, last_visit."lastVisitAt" DESC NULLS LAST, c."fullName" ASC, c.id ASC`;
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT c.id
    FROM "Client" c
    LEFT JOIN LATERAL (
      SELECT MAX(b."scheduledStartsAt") AS "lastVisitAt"
      FROM "Booking" b
      WHERE b."clientId" = c.id
        AND b.status = ${BookingStatus.COMPLETED}
        AND b."scheduledStartsAt" < ${retentionReference}
    ) last_visit ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total
      FROM "Booking" b
      WHERE b."clientId" = c.id
    ) booking_count ON true
    LEFT JOIN LATERAL (
      SELECT MIN(b."scheduledStartsAt") AS "nextBookingAt"
      FROM "Booking" b
      WHERE b."clientId" = c.id
        AND b.status IN (${BookingStatus.PENDING}, ${BookingStatus.CONFIRMED})
        AND b."scheduledStartsAt" >= ${retentionReference}
    ) next_booking ON true
    ${sqlWhere}
    ORDER BY ${orderBy}
    LIMIT ${clientPageSize} OFFSET ${skip}
  `);

  return rows.map((row) => row.id);
}

export function getAdminClientHref(area: AdminArea, clientId: string) {
  return area === "owner"
    ? `/admin/klienti/${clientId}`
    : `/admin/provoz/klienti/${clientId}`;
}

const clientViewDefinitions: Array<{ value: ClientListViewValue; label: string }> = [
  { value: "all", label: "Vše" },
  { value: "upcoming", label: "Přijdou" },
  { value: "outreach", label: "K oslovení" },
  { value: "new", label: "Nové" },
  { value: "no_contact", label: "Bez kontaktu" },
  { value: "inactive", label: "Neaktivní" },
];

function getClientsPath(area: AdminArea) {
  return area === "owner" ? "/admin/klienti" : "/admin/provoz/klienti";
}

function buildClientsHref(area: AdminArea, filters: ReturnType<typeof normalizeSearchParams>, view: ClientListViewValue, retention?: "8_11" | "12_15" | "16_plus", referenceAt?: Date) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (view !== "all") params.set("view", view);
  if (["all", "no_contact", "inactive"].includes(view) && filters.quick !== "all") params.set("quick", filters.quick);
  if (["all", "no_contact", "inactive"].includes(view) && filters.sort !== "recent") params.set("sort", filters.sort);
  if (view === "outreach" && retention) params.set("retention", retention);
  if (view === "outreach" && referenceAt) params.set("retentionAt", String(referenceAt.getTime()));
  const query = params.toString();
  return query ? `${getClientsPath(area)}?${query}` : getClientsPath(area);
}

function buildViews(area: AdminArea, filters: ReturnType<typeof normalizeSearchParams>, counts: Record<ClientListViewValue, number>, referenceAt: Date) {
  return clientViewDefinitions.map((definition) => ({
    ...definition,
    count: counts[definition.value],
    href: buildClientsHref(area, filters, definition.value, undefined, definition.value === "outreach" ? referenceAt : undefined),
    isActive: filters.view === definition.value,
  }));
}

function buildOutreach(area: AdminArea, filters: ReturnType<typeof normalizeSearchParams>, referenceAt: Date, counts: [number, number, number]) {
  const bands = ([
    ["8_11", "8–11 týdnů"],
    ["12_15", "12–15 týdnů"],
    ["16_plus", "16+ týdnů"],
  ] as const).map(([value, label], index) => ({ value, label, count: counts[index], href: buildClientsHref(area, filters, "outreach", value, referenceAt) }));
  return { totalCount: counts.reduce((total, count) => total + count, 0), referenceAt, bands };
}

function getEmptyState(view: ClientListViewValue) {
  const messages: Record<ClientListViewValue, { title: string; description: string }> = {
    all: { title: "Nenalezeny žádné aktivní klientky.", description: "" },
    upcoming: { title: "Žádná klientka nemá naplánovanou budoucí návštěvu.", description: "" },
    outreach: { title: "Žádná klientka nyní není k oslovení.", description: "" },
    new: { title: "Za posledních 30 dní nebyl vytvořen žádný nový profil.", description: "" },
    no_contact: { title: "Všechny aktivní klientky mají uvedený kontakt.", description: "" },
    inactive: { title: "Nejsou evidované žádné neaktivní klientky.", description: "" },
  };
  return messages[view];
}

export async function getAdminClientsPageData(
  area: AdminArea,
  searchParams?: Record<string, string | string[] | undefined>,
) {
  let filters = normalizeSearchParams(searchParams);
  const now = new Date();
  const retentionReference = filters.retentionAt
    ? new Date(Math.min(Number(filters.retentionAt), now.getTime()))
    : now;
  if (filters.view === "outreach") filters = { ...filters, retentionAt: String(retentionReference.getTime()) };
  const recentThreshold = new Date(now);
  recentThreshold.setDate(recentThreshold.getDate() - 30);
  const where = buildClientWhere(filters, recentThreshold, retentionReference);
  const viewFilters = (view: ClientListViewValue) => buildClientWhere({ ...filters, view, quick: "all", retention: undefined }, recentThreshold, retentionReference);
  const [filteredCount, allCount, upcomingCount, outreachCount, newCount, noContactCount, inactiveCount, band8, band12, band16] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.count({ where: viewFilters("all") }),
    prisma.client.count({ where: viewFilters("upcoming") }),
    prisma.client.count({ where: viewFilters("outreach") }),
    prisma.client.count({ where: viewFilters("new") }),
    prisma.client.count({ where: viewFilters("no_contact") }),
    prisma.client.count({ where: viewFilters("inactive") }),
    prisma.client.count({ where: buildClientWhere({ ...filters, view: "outreach", quick: "all", retention: "8_11" }, recentThreshold, retentionReference) }),
    prisma.client.count({ where: buildClientWhere({ ...filters, view: "outreach", quick: "all", retention: "12_15" }, recentThreshold, retentionReference) }),
    prisma.client.count({ where: buildClientWhere({ ...filters, view: "outreach", quick: "all", retention: "16_plus" }, recentThreshold, retentionReference) }),
  ]);
  const totalPages = filteredCount === 0 ? 1 : Math.ceil(filteredCount / clientPageSize);
  const page = Math.min(filters.page, totalPages);
  const clientIds = await getOrderedClientPageIds(filters, where, recentThreshold, retentionReference, page);
  const clients = clientIds.length > 0
    ? await prisma.client.findMany({
      where: { id: { in: clientIds } },
      include: {
        _count: {
          select: {
            bookings: true,
          },
        },
        bookings: {
          where: {
            status: BookingStatus.COMPLETED,
            scheduledStartsAt: {
              lt: retentionReference,
            },
          },
          orderBy: {
            scheduledStartsAt: "desc",
          },
          take: 1,
          select: {
            scheduledStartsAt: true,
            serviceNameSnapshot: true,
          },
        },
      },
    })
    : [];
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const pageClients = clientIds.flatMap((id) => {
    const client = clientsById.get(id);
    return client ? [client] : [];
  });
  const futureBookings = pageClients.length
    ? await prisma.booking.findMany({
      where: { clientId: { in: pageClients.map((client) => client.id) }, status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] }, scheduledStartsAt: { gte: now } },
      orderBy: { scheduledStartsAt: "asc" },
      select: { clientId: true, scheduledStartsAt: true, serviceNameSnapshot: true },
    })
    : [];
  const nextBookingByClientId = new Map<string, (typeof futureBookings)[number]>();
  for (const booking of futureBookings) if (!nextBookingByClientId.has(booking.clientId)) nextBookingByClientId.set(booking.clientId, booking);
  const normalizedClients = pageClients.map((client) => ({
      ...client,
      email: client.email ?? "",
      lastVisitAt: client.bookings[0]?.scheduledStartsAt ?? null,
      lastServiceName: client.bookings[0]?.serviceNameSnapshot ?? null,
      nextBooking: nextBookingByClientId.get(client.id) ?? null,
      isTestRecord: isTestClientRecord(client.fullName, client.email),
    }));

  return {
    area,
    filters,
    views: buildViews(area, filters, { all: allCount, upcoming: upcomingCount, outreach: outreachCount, new: newCount, no_contact: noContactCount, inactive: inactiveCount }, retentionReference),
    outreach: buildOutreach(area, filters, retentionReference, [band8, band12, band16]),
    emptyState: getEmptyState(filters.view),
    clients: normalizedClients.map((client): AdminClientsListItem => {
      const email = client.email.trim();
      const phone = client.phone?.trim() ?? "";

      return {
        id: client.id,
        href: getAdminClientHref(area, client.id),
        fullName: client.fullName,
        email,
        emailHref: normalizeEmailHref(email),
        phoneDisplay: phone ? formatClientPhoneForDisplay(phone) : "",
        phoneHref: buildClientPhoneHref(phone),
        isActive: client.isActive,
        totalBookings: client._count.bookings,
        lastVisitLabel: client.lastVisitAt ? formatDateLabel(client.lastVisitAt) : "Bez návštěvy",
        lastServiceName: client.lastServiceName,
        weeksWithoutVisit: getWeeksWithoutVisit(client.lastVisitAt, retentionReference),
        nextBookingLabel: client.nextBooking
          ? `${formatDateLabel(client.nextBooking.scheduledStartsAt)} · ${client.nextBooking.serviceNameSnapshot}`
          : "Bez další rezervace",
        hasNote: Boolean(client.internalNote?.trim()),
        isTestRecord: client.isTestRecord,
      };
    }),
    retentionReference,
    pagination: {
      page,
      pageSize: clientPageSize,
      totalCount: filteredCount,
      totalPages,
      firstItemNumber: filteredCount === 0 ? 0 : (page - 1) * clientPageSize + 1,
      lastItemNumber: (page - 1) * clientPageSize + pageClients.length,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    },
    currentPath: area === "owner" ? "/admin/klienti" : "/admin/provoz/klienti",
  };
}


function isTestClientRecord(fullName: string, email: string | null) {
  const normalizedName = fullName.toLocaleLowerCase("cs-CZ");
  const normalizedEmail = (email ?? "").toLocaleLowerCase("cs-CZ");

  return normalizedEmail.endsWith("@example.com")
    || normalizedName.includes("voucher klientka")
    || normalizedName.includes("kolize")
    || normalizedEmail.includes("booking-voucher")
    || normalizedEmail.includes("client-collision");
}

export type AdminClientDetailData = {
  id: string;
  area: AdminArea;
  fullName: string;
  email: string;
  emailValue: string;
  emailHref: string | null;
  phone: string;
  phoneValue: string;
  phoneHref: string | null;
  isActive: boolean;
  statusLabel: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  lastBookedAtLabel: string;
  nextBookingLabel: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  upcomingBookings: number;
  favoriteServiceName: string;
  crmSummary: ClientCrmSummary;
  internalNote: string;
  bookings: Array<{
    id: string;
    serviceName: string;
    status: BookingStatus;
    statusLabel: string;
    sourceLabel: string;
    scheduledAtLabel: string;
    notes: Array<{
      label: "Klientka" | "Interně";
      value: string;
    }>;
    href: string;
  }>;
};

function buildClientVisitNotes(booking: {
  clientNote: string | null;
  internalNote: string | null;
}) {
  const notes: AdminClientDetailData["bookings"][number]["notes"] = [];

  if (booking.clientNote?.trim()) {
    notes.push({
      label: "Klientka",
      value: booking.clientNote.trim(),
    });
  }

  if (booking.internalNote?.trim()) {
    notes.push({
      label: "Interně",
      value: booking.internalNote.trim(),
    });
  }

  return notes;
}

export async function getAdminClientDetailData(
  area: AdminArea,
  clientId: string,
): Promise<AdminClientDetailData | null> {
  const now = new Date();

  const [
    client,
    nextBooking,
    lastCompletedBooking,
    completedBookings,
    cancelledBookings,
    noShowBookings,
    upcomingBookings,
    favoriteService,
    crmBookings,
  ] =
    await Promise.all([
      prisma.client.findUnique({
        where: { id: clientId },
        include: {
          _count: {
            select: {
              bookings: true,
            },
          },
          bookings: {
            orderBy: { scheduledStartsAt: "desc" },
            take: 10,
            select: {
              id: true,
              serviceNameSnapshot: true,
              status: true,
              source: true,
              scheduledStartsAt: true,
              scheduledEndsAt: true,
              clientNote: true,
              internalNote: true,
            },
          },
        },
      }),
      prisma.booking.findFirst({
        where: {
          clientId,
          status: {
            in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
          },
          scheduledStartsAt: {
            gte: now,
          },
        },
        orderBy: { scheduledStartsAt: "asc" },
        select: {
          scheduledStartsAt: true,
          scheduledEndsAt: true,
        },
      }),
      prisma.booking.findFirst({
        where: {
          clientId,
          status: BookingStatus.COMPLETED,
        },
        orderBy: { scheduledStartsAt: "desc" },
        select: {
          scheduledStartsAt: true,
        },
      }),
      prisma.booking.count({
        where: {
          clientId,
          status: BookingStatus.COMPLETED,
        },
      }),
      prisma.booking.count({
        where: {
          clientId,
          status: BookingStatus.CANCELLED,
        },
      }),
      prisma.booking.count({
        where: {
          clientId,
          status: BookingStatus.NO_SHOW,
        },
      }),
      prisma.booking.count({
        where: {
          clientId,
          status: {
            in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
          },
          scheduledStartsAt: {
            gte: now,
          },
        },
      }),
      prisma.booking.groupBy({
        by: ["serviceNameSnapshot"],
        where: {
          clientId,
        },
        _count: {
          serviceNameSnapshot: true,
        },
        orderBy: {
          _count: {
            serviceNameSnapshot: "desc",
          },
        },
        take: 1,
      }),
      prisma.booking.findMany({
        where: {
          clientId,
        },
        select: {
          id: true,
          status: true,
          serviceNameSnapshot: true,
          servicePriceFromCzk: true,
          finalPriceCzk: true,
          scheduledStartsAt: true,
          scheduledEndsAt: true,
          voucherRedemptions: {
            select: {
              amountCzk: true,
            },
          },
          payments: {
            select: {
              amountCzk: true,
              status: true,
            },
          },
        },
      }),
    ]);

  if (!client) {
    return null;
  }

  const normalizedPhone = buildClientPhoneHref(client.phone);
  const normalizedEmail = normalizeEmailHref(client.email);
  const emailValue = client.email ?? "";
  const phoneValue = client.phone ? formatClientPhoneForDisplay(client.phone) : "";

  return {
    id: client.id,
    area,
    fullName: client.fullName,
    email: emailValue || "Bez e-mailu",
    emailValue,
    emailHref: normalizedEmail,
    phone: client.phone ? formatClientPhoneForDisplay(client.phone) : "Telefon není vyplněný",
    phoneValue,
    phoneHref: normalizedPhone,
    isActive: client.isActive,
    statusLabel: client.isActive ? "Aktivní" : "Neaktivní",
    createdAtLabel: formatDateTimeLabel(client.createdAt),
    updatedAtLabel: formatDateTimeLabel(client.updatedAt),
    lastBookedAtLabel: formatDateLabel(lastCompletedBooking?.scheduledStartsAt),
    nextBookingLabel: nextBooking
      ? formatBookingDateLabel(nextBooking.scheduledStartsAt, nextBooking.scheduledEndsAt)
      : "Bez budoucího termínu",
    totalBookings: client._count.bookings,
    completedBookings,
    cancelledBookings,
    noShowBookings,
    upcomingBookings,
    favoriteServiceName: favoriteService[0]?.serviceNameSnapshot ?? "Zatím bez historie",
    crmSummary: getClientCrmSummary(crmBookings, { now }),
    internalNote: client.internalNote ?? "",
    bookings: client.bookings.map((booking) => ({
      id: booking.id,
      serviceName: booking.serviceNameSnapshot,
      status: booking.status,
      statusLabel: getBookingStatusLabel(booking.status),
      sourceLabel: getBookingSourceLabel(booking.source),
      scheduledAtLabel: formatBookingDateLabel(booking.scheduledStartsAt, booking.scheduledEndsAt),
      notes: buildClientVisitNotes(booking),
      href: getAdminBookingHref(area, booking.id),
    })),
  };
}

function normalizeEmailHref(email: string | null) {
  const normalized = email?.trim() ?? "";

  return normalized.length > 0 ? `mailto:${normalized}` : null;
}
