import {
  BookingActionTokenType,
  AvailabilitySlotStatus,
  BookingStatus,
  EmailLogStatus,
  EmailLogType,
  MediaAssetKind,
  MediaAssetVisibility,
  Prisma,
} from "@prisma/client";

import { type AdminArea, type AdminSectionSlug } from "@/config/navigation";
import {
  getAdminBookingActionOptions,
  getAdminBookingHref,
  getBookingSourceLabel,
  getBookingStatusLabel,
} from "@/features/admin/lib/admin-booking";
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
    case "certifikaty":
      return "Certifikáty";
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
    case "certifikaty":
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
  stats: Array<{
    label: string;
    value: string;
    tone?: "default" | "accent" | "muted";
    detail?: string;
  }>;
  items: Array<{
    id: string;
    title: string;
    serviceName: string;
    scheduledDateLabel: string;
    scheduledTimeLabel: string;
    status: BookingStatus;
    statusLabel: string;
    sourceLabel: string;
    contactLabel: string;
    href: string;
    availableActions: ReturnType<typeof getAdminBookingActionOptions>;
  }>;
};

async function getReservationsData(area: AdminArea) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const [today, pending, confirmed, completed, cancelled, items] = await Promise.all([
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
    prisma.booking.findMany({
      orderBy: { scheduledStartsAt: "asc" },
      where: area === "salon" ? { scheduledStartsAt: { gte: todayStart } } : undefined,
      take: 24,
      include: {
        client: { select: { fullName: true, phone: true } },
        service: { select: { name: true } },
      },
    }),
  ]);

  return {
    stats: [
      { label: "Dnes a dál", value: String(today), tone: "accent" as const },
      { label: "Čeká", value: String(pending) },
      { label: "Potvrzené", value: String(confirmed) },
      { label: "Hotovo", value: String(completed), tone: "muted" as const },
      { label: "Zrušené", value: String(cancelled), tone: "muted" as const },
    ],
    items: items.map((booking) => ({
      id: booking.id,
      title: booking.client.fullName,
      serviceName: booking.service.name,
      scheduledDateLabel: formatDateLabel(booking.scheduledStartsAt),
      scheduledTimeLabel: `${formatTime.format(booking.scheduledStartsAt)} - ${formatTime.format(booking.scheduledEndsAt)}`,
      status: booking.status,
      statusLabel: getBookingStatusLabel(booking.status),
      sourceLabel: getBookingSourceLabel(booking.source),
      contactLabel: booking.client.phone ?? booking.clientEmailSnapshot,
      href: getAdminBookingHref(area, booking.id),
      availableActions: getAdminBookingActionOptions(booking.status),
    })),
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
        kind: MediaAssetKind.CERTIFICATE,
        visibility: MediaAssetVisibility.PUBLIC,
      },
    }),
    prisma.mediaAsset.findMany({
      where: {
        kind: MediaAssetKind.CERTIFICATE,
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
      title: asset.title || asset.originalFilename,
      meta: `${asset.mimeType} • ${Math.round(asset.sizeBytes / 1024)} KB`,
      description: area === "owner"
        ? `Nahráno ${formatDateLabel(asset.createdAt)} • soubor ${asset.storedFilename}`
        : `Nahráno ${formatDateLabel(asset.createdAt)}`,
      badge: asset.visibility === MediaAssetVisibility.PUBLIC ? "Veřejné" : "Soukromé",
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
