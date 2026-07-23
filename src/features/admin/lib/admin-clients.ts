import { BookingStatus, Prisma } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  clientListSearchParamsSchema,
  normalizeClientListPage,
  type ClientListQuickFilterValue,
  type ClientListSortValue,
  type ClientListStatusValue,
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
    status: typeof searchParams?.status === "string" ? searchParams.status : undefined,
    sort: typeof searchParams?.sort === "string" ? searchParams.sort : undefined,
    quick: typeof searchParams?.quick === "string" ? searchParams.quick : undefined,
    retention: typeof searchParams?.retention === "string" ? searchParams.retention : undefined,
    retentionAt: typeof searchParams?.retentionAt === "string" ? searchParams.retentionAt : undefined,
    page: typeof searchParams?.page === "string" ? searchParams.page : undefined,
  });

  const defaults = {
    query: "",
    status: "all" as ClientListStatusValue,
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
    status: parsed.data.status ?? defaults.status,
    sort: parsed.data.sort ?? defaults.sort,
    quick: parsed.data.quick ?? defaults.quick,
    retention: parsed.data.retention,
    retentionAt: parsed.data.retentionAt,
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

  if (filters.status === "active") {
    where.isActive = true;
  }

  if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.query) {
    where.OR = [
      { fullName: { contains: filters.query, mode: "insensitive" } },
      { email: { contains: filters.query, mode: "insensitive" } },
      { phone: { contains: filters.query, mode: "insensitive" } },
      { internalNote: { contains: filters.query, mode: "insensitive" } },
    ];
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
    case "no_contact":
      andFilters.push(hasNoContactWhere());
      break;
    case "noted":
      andFilters.push(hasInternalNoteWhere());
      break;
    case "new_30":
      andFilters.push({
        createdAt: {
          gte: recentThreshold,
        },
      });
      break;
    case "all":
    default:
      break;
  }

  if (filters.retention) {
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

  if (filters.status === "active") clauses.push(Prisma.sql`c."isActive" = true`);
  if (filters.status === "inactive") clauses.push(Prisma.sql`c."isActive" = false`);
  if (filters.query) {
    const query = `%${filters.query}%`;
    clauses.push(Prisma.sql`(c."fullName" ILIKE ${query} OR c.email ILIKE ${query} OR c.phone ILIKE ${query} OR c."internalNote" ILIKE ${query})`);
  }

  switch (filters.quick) {
    case "with_booking":
      clauses.push(Prisma.sql`EXISTS (SELECT 1 FROM "Booking" b WHERE b."clientId" = c.id)`);
      break;
    case "without_booking":
      clauses.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."clientId" = c.id)`);
      break;
    case "no_contact":
      clauses.push(Prisma.sql`(c.email IS NULL OR c.email = '') AND (c.phone IS NULL OR c.phone = '')`);
      break;
    case "noted":
      clauses.push(Prisma.sql`c."internalNote" IS NOT NULL AND c."internalNote" <> ''`);
      break;
    case "new_30":
      clauses.push(Prisma.sql`c."createdAt" >= ${recentThreshold}`);
      break;
  }

  if (filters.retention) {
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

  if (filters.sort === "name" || filters.sort === "created") {
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
  const orderBy = filters.sort === "recent"
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

export async function getAdminClientsPageData(
  area: AdminArea,
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const filters = normalizeSearchParams(searchParams);
  const now = new Date();
  const retentionReference = filters.retentionAt
    ? new Date(Math.min(Number(filters.retentionAt), now.getTime()))
    : now;
  const recentThreshold = new Date(now);
  recentThreshold.setDate(recentThreshold.getDate() - 30);
  const where = buildClientWhere(filters, recentThreshold, retentionReference);
  const [totalCount, newCount, noContactCount, notedCount, activeRecentCount, filteredCount] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({
      where: {
        createdAt: {
          gte: recentThreshold,
        },
      },
    }),
    prisma.client.count({ where: hasNoContactWhere() }),
    prisma.client.count({ where: hasInternalNoteWhere() }),
    prisma.client.count({
      where: {
        bookings: {
          some: {
            status: BookingStatus.COMPLETED,
            scheduledStartsAt: {
              gte: recentThreshold,
              lt: now,
            },
          },
        },
      },
    }),
    prisma.client.count({ where }),
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
    stats: [
      {
        label: area === "owner" ? "Klientů celkem" : "Klientek celkem",
        value: String(totalCount),
        tone: "accent" as const,
        detail: "Všechny profily v databázi.",
      },
      {
        label: "Nové za 30 dní",
        value: String(newCount),
        detail: activeRecentCount > newCount
          ? `Aktivní za 30 dní: ${activeRecentCount}`
          : "Nově založené profily.",
      },
      {
        label: "Bez kontaktu",
        value: String(noContactCount),
        tone: noContactCount > 0 ? ("muted" as const) : undefined,
        detail: "Bez e-mailu i telefonu.",
      },
      {
        label: "S poznámkou",
        value: String(notedCount),
        detail: "Profily s interním kontextem.",
      },
    ],
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
