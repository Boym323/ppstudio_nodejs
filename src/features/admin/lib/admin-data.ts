import {
  AdminRole,
  AvailabilitySlotStatus,
  BookingStatus,
  EmailLogStatus,
} from "@prisma/client";

import { type AdminArea, type AdminSectionSlug } from "@/config/navigation";
import { listBootstrapAdminUsers, type BootstrapAdminUser } from "@/lib/auth/session";
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
              detail: "Součet DB uživatelů a bootstrap přístupů.",
            },
            {
              label: "Chybné e-maily",
              value: String(emailFailures),
              tone: emailFailures > 0 ? "accent" : "muted",
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
    case "sluzby":
      return getServicesData(area);
    case "kategorie-sluzeb":
      return getCategoriesData(area);
    case "uzivatele":
      return getUsersData();
    case "email-logy":
      return getEmailLogsData();
    case "nastaveni":
      return getSettingsData();
    case "overview":
      return getAdminOverviewData(area);
  }
}

async function getReservationsData(area: AdminArea) {
  const now = new Date();
  const [pending, confirmed, completed, items] = await Promise.all([
    prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
    prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
    prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
    prisma.booking.findMany({
      orderBy: { scheduledStartsAt: "asc" },
      where: area === "salon" ? { scheduledStartsAt: { gte: now } } : undefined,
      take: 10,
      include: {
        client: { select: { fullName: true, phone: true } },
        service: { select: { name: true } },
      },
    }),
  ]);

  return {
    stats: [
      { label: "Čekající", value: String(pending), tone: "accent" as const },
      { label: "Potvrzené", value: String(confirmed) },
      { label: "Dokončené", value: String(completed), tone: "muted" as const },
    ],
    items: items.map((booking) => ({
      id: booking.id,
      title: `${booking.client.fullName} • ${booking.service.name}`,
      meta: `${formatDateTimeLabel(booking.scheduledStartsAt)} • ${statusLabel(booking.status)}`,
      description:
        area === "owner"
          ? `Zdroj: ${booking.source}. Kontakt: ${booking.client.phone ?? booking.clientEmailSnapshot}.`
          : `Kontakt: ${booking.client.phone ?? booking.clientEmailSnapshot}.`,
      badge: statusLabel(booking.status),
    })),
  };
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
          ? `Cena od ${service.priceFromCzk ? `${service.priceFromCzk} Kč` : "nenastavena"}. Slug: ${service.slug}.`
          : `Cena od ${service.priceFromCzk ? `${service.priceFromCzk} Kč` : "nenastavena"}.`,
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

async function getUsersData() {
  const [dbUsers, bootstrapUsers] = await Promise.all([
    prisma.adminUser.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      take: 12,
    }),
    Promise.resolve(listBootstrapAdminUsers()),
  ]);

  return {
    stats: [
      { label: "DB uživatelé", value: String(dbUsers.length), tone: "accent" as const },
      { label: "Bootstrap účty", value: String(bootstrapUsers.length) },
    ],
    items: [
      ...dbUsers.map((user) => ({
        id: user.id,
        title: user.name,
        meta: `${user.email} • ${user.role === AdminRole.OWNER ? "ADMIN" : "SALON"}`,
        description: `Aktivní: ${user.isActive ? "ano" : "ne"} • poslední login ${formatDateTimeLabel(user.lastLoginAt)}`,
        badge: user.role === AdminRole.OWNER ? "ADMIN" : "SALON",
      })),
      ...bootstrapUsers.map((user) => mapBootstrapUser(user)),
    ],
  };
}

function mapBootstrapUser(user: BootstrapAdminUser) {
  return {
    id: user.id,
    title: `${user.name} (bootstrap)`,
    meta: `${user.email} • ${user.role === AdminRole.OWNER ? "ADMIN" : "SALON"}`,
    description:
      "Přístup načítaný z env proměnných. V další iteraci ho lze nahradit plnou DB správou uživatelů.",
    badge: user.role === AdminRole.OWNER ? "ADMIN" : "SALON",
  };
}

async function getEmailLogsData() {
  const [pending, sent, failed, items] = await Promise.all([
    prisma.emailLog.count({ where: { status: EmailLogStatus.PENDING } }),
    prisma.emailLog.count({ where: { status: EmailLogStatus.SENT } }),
    prisma.emailLog.count({ where: { status: EmailLogStatus.FAILED } }),
    prisma.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        booking: { select: { clientNameSnapshot: true } },
      },
    }),
  ]);

  return {
    stats: [
      { label: "Čeká", value: String(pending) },
      { label: "Odesláno", value: String(sent), tone: "accent" as const },
      { label: "Chyba", value: String(failed), tone: failed > 0 ? "accent" : "muted" as const },
    ],
    items: items.map((log) => ({
      id: log.id,
      title: `${log.subject} • ${log.recipientEmail}`,
      meta: `${statusLabel(log.status)} • ${formatDateTimeLabel(log.createdAt)}`,
      description: `${log.type} • klientka ${log.booking?.clientNameSnapshot ?? "bez rezervace"}${log.errorMessage ? ` • ${log.errorMessage}` : ""}`,
      badge: statusLabel(log.status),
    })),
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
