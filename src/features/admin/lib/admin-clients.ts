import { BookingStatus, Prisma } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  clientListSearchParamsSchema,
  type ClientListSortValue,
  type ClientListStatusValue,
} from "@/features/admin/lib/admin-client-validation";
import {
  getAdminBookingHref,
  getBookingSourceLabel,
  getBookingStatusLabel,
} from "@/features/admin/lib/admin-booking";
import { prisma } from "@/lib/prisma";

const formatDate = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
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

function formatBookingDateLabel(startsAt: Date, endsAt: Date) {
  return `${formatDateTimeLabel(startsAt)} - ${new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(endsAt)}`;
}

function normalizeSearchParams(searchParams?: Record<string, string | string[] | undefined>) {
  const parsed = clientListSearchParamsSchema.safeParse({
    query: typeof searchParams?.query === "string" ? searchParams.query : undefined,
    status: typeof searchParams?.status === "string" ? searchParams.status : undefined,
    sort: typeof searchParams?.sort === "string" ? searchParams.sort : undefined,
  });

  const defaults = {
    query: "",
    status: "all" as ClientListStatusValue,
    sort: "recent" as ClientListSortValue,
  };

  if (!parsed.success) {
    return defaults;
  }

  return {
    query: parsed.data.query ?? defaults.query,
    status: parsed.data.status ?? defaults.status,
    sort: parsed.data.sort ?? defaults.sort,
  };
}

function buildClientWhere(filters: ReturnType<typeof normalizeSearchParams>): Prisma.ClientWhereInput {
  const where: Prisma.ClientWhereInput = {};

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

  return where;
}

function buildClientOrderBy(sort: ClientListSortValue): Prisma.ClientOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ fullName: "asc" }];
    case "created":
      return [{ createdAt: "desc" }];
    case "bookings":
      return [{ bookings: { _count: "desc" } }, { lastBookedAt: "desc" }, { fullName: "asc" }];
    case "recent":
    default:
      return [{ lastBookedAt: "desc" }, { createdAt: "desc" }];
  }
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
  const where = buildClientWhere(filters);
  const recentThreshold = new Date();
  recentThreshold.setDate(recentThreshold.getDate() - 30);

  const [activeCount, inactiveCount, notedCount, recentCount, clients] = await Promise.all([
    prisma.client.count({ where: { isActive: true } }),
    prisma.client.count({ where: { isActive: false } }),
    prisma.client.count({
      where: {
        internalNote: {
          not: null,
        },
      },
    }),
    prisma.client.count({
      where: {
        lastBookedAt: {
          gte: recentThreshold,
        },
      },
    }),
    prisma.client.findMany({
      where,
      orderBy: buildClientOrderBy(filters.sort),
      include: {
        _count: {
          select: {
            bookings: true,
          },
        },
      },
    }),
  ]);

  return {
    area,
    filters,
    stats: [
      {
        label: "Aktivní klienti",
        value: String(activeCount),
        tone: "accent" as const,
        detail: "Profily připravené k další práci.",
      },
      {
        label: "Neaktivní klienti",
        value: String(inactiveCount),
        tone: "muted" as const,
        detail: "Skryté nebo dočasně vypnuté profily.",
      },
      {
        label: "S interní poznámkou",
        value: String(notedCount),
        detail: "Profily s uloženým provozním kontextem.",
      },
      {
        label: "Aktivní za 30 dní",
        value: String(recentCount),
        detail: "Návštěva nebo booking za posledních 30 dní.",
      },
    ],
    clients: clients.map((client) => ({
      ...client,
      email: client.email ?? "",
    })),
    currentPath: area === "owner" ? "/admin/klienti" : "/admin/provoz/klienti",
  };
}

export type AdminClientDetailData = {
  id: string;
  area: AdminArea;
  fullName: string;
  email: string;
  emailHref: string | null;
  phone: string;
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
  internalNote: string;
  bookings: Array<{
    id: string;
    serviceName: string;
    status: BookingStatus;
    statusLabel: string;
    sourceLabel: string;
    scheduledAtLabel: string;
    noteSummary: string;
    href: string;
  }>;
};

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
    ]);

  if (!client) {
    return null;
  }

  const normalizedPhone = normalizePhoneHref(client.phone);
  const normalizedEmail = normalizeEmailHref(client.email);

  return {
    id: client.id,
    area,
    fullName: client.fullName,
    email: client.email ?? "Bez e-mailu",
    emailHref: normalizedEmail,
    phone: client.phone ?? "Telefon není vyplněný",
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
    internalNote: client.internalNote ?? "",
    bookings: client.bookings.map((booking) => ({
      id: booking.id,
      serviceName: booking.serviceNameSnapshot,
      status: booking.status,
      statusLabel: getBookingStatusLabel(booking.status),
      sourceLabel: getBookingSourceLabel(booking.source),
      scheduledAtLabel: formatBookingDateLabel(booking.scheduledStartsAt, booking.scheduledEndsAt),
      noteSummary: booking.internalNote ?? booking.clientNote ?? "Bez doplňující poznámky.",
      href: getAdminBookingHref(area, booking.id),
    })),
  };
}

function normalizePhoneHref(phone: string | null) {
  const normalized = phone?.replace(/[^+\d]/g, "") ?? "";

  return normalized.length > 0 ? `tel:${normalized}` : null;
}

function normalizeEmailHref(email: string | null) {
  const normalized = email?.trim() ?? "";

  return normalized.length > 0 ? `mailto:${normalized}` : null;
}
