import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingStatus,
  Prisma,
} from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  createSlotRecord,
  deleteSlotRecord,
  findSlotOverlap,
  getServicesByIds,
  getSlotDetailById,
  getSlotForWrite,
  listActiveServicesForSlotForm,
  listAdminSlots,
  updateSlotRecord,
} from "@/features/admin/lib/admin-slot-repository";
import { prisma } from "@/lib/prisma";

const formatDateLong = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const formatDateTime = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const formatTime = new Intl.DateTimeFormat("cs-CZ", {
  hour: "2-digit",
  minute: "2-digit",
});

const formatWeekdayLong = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
});

const formatWeekdayShort = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "short",
});

const formatMonthDay = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
});

const defaultAvailabilityWindow = {
  startHour: 8,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
};

export const activeBookingStatuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;

function isActiveBookingStatus(status: BookingStatus) {
  return activeBookingStatuses.includes(status as (typeof activeBookingStatuses)[number]);
}

export type AdminSlotFilterInput = {
  week?: string;
  day?: string;
  status?: string;
  panel?: string;
  slot?: string;
  flash?: string;
};

export type AdminSlotFormInput = {
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: AvailabilitySlotStatus;
  serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
  publicNote?: string;
  internalNote?: string;
  serviceIds: string[];
};

type PersistSlotInput = AdminSlotFormInput & {
  actorUserId: string;
};

export type BatchCreateSlotsInput = {
  day: Date;
  startTime: string;
  slotCount: number;
  slotLengthMinutes: number;
  gapMinutes: number;
  capacity: number;
  status: AvailabilitySlotStatus;
  actorUserId: string;
};

export class AdminSlotError extends Error {
  fieldErrors?: Record<string, string>;

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AdminSlotError";
    this.fieldErrors = fieldErrors;
  }
}

export type SlotFlashMeta = {
  tone: "success" | "error";
  message: string;
};

export type SlotPlannerPanel = "day" | "create" | "batch";

export type AdminSlotPlannerSlot = {
  id: string;
  startsAtInput: string;
  endsAtInput: string;
  startsAtLabel: string;
  endsAtLabel: string;
  timeRangeLabel: string;
  timeShortLabel: string;
  statusLabel: string;
  status: AvailabilitySlotStatus;
  occupancyLabel: string;
  activeBookingsCount: number;
  totalBookingsCount: number;
  capacity: number;
  freeCapacity: number;
  restrictionLabel: string;
  serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
  serviceIds: string[];
  allowedServiceNames: string[];
  publicNote: string | null;
  internalNote: string | null;
  createdByLabel: string;
  canDelete: boolean;
  hasActiveBookings: boolean;
};

export type AdminSlotPlannerDay = {
  dateKey: string;
  dateLabel: string;
  weekdayShortLabel: string;
  weekdayLabel: string;
  headingLabel: string;
  stateLabel: string;
  stateTone: "empty" | "active" | "limited" | "cancelled";
  summaryLabel: string;
  timeRangeLabel: string;
  availabilityWindowLabel: string;
  availabilityWindowHint: string;
  slotCount: number;
  publishedCount: number;
  freeCount: number;
  occupiedCount: number;
  cancelledCount: number;
  draftCount: number;
  archivedCount: number;
  suggestedStartsAtInput: string;
  suggestedEndsAtInput: string;
  slots: AdminSlotPlannerSlot[];
};

export type AdminSlotPlannerData = {
  area: AdminArea;
  filters: {
    weekInput: string;
    dayInput: string;
    statusInput: string;
    panelInput: SlotPlannerPanel;
    slotInput?: string;
    flash?: SlotFlashMeta;
  };
  weekLabel: string;
  days: AdminSlotPlannerDay[];
  selectedDay: AdminSlotPlannerDay;
  selectedSlot: AdminSlotPlannerSlot | null;
  stats: {
    total: number;
    published: number;
    free: number;
    occupied: number;
    emptyDays: number;
  };
};

function formatDateTimeLabel(value: Date | null | undefined) {
  if (!value) {
    return "Bez času";
  }

  return formatDateTime.format(value);
}

function getStartOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getStartOfWeek(value: Date) {
  const next = getStartOfDay(value);
  const dayIndex = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - dayIndex);
  return next;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getMonthDayLabel(value: Date) {
  return formatMonthDay.format(value).replace(/\s/g, "");
}

function getWeekdayShortLabel(value: Date) {
  return formatWeekdayShort
    .format(value)
    .replace(/\./g, "")
    .replace(/^./, (char) => char.toUpperCase());
}

function getWeekdayLongLabel(value: Date) {
  return formatWeekdayLong.format(value).replace(/^./, (char) => char.toUpperCase());
}

export function getDefaultAvailabilityWindowForDay(day: Date) {
  const start = new Date(day);
  start.setHours(defaultAvailabilityWindow.startHour, defaultAvailabilityWindow.startMinute, 0, 0);

  const end = new Date(day);
  end.setHours(defaultAvailabilityWindow.endHour, defaultAvailabilityWindow.endMinute, 0, 0);

  return { start, end };
}

function formatTimeRange(start: Date, end: Date) {
  return `${formatTime.format(start)} - ${formatTime.format(end)}`;
}

function parseDateOnlyInput(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function getAdminSlotListHref(area: AdminArea) {
  return area === "owner" ? "/admin/volne-terminy" : "/admin/provoz/volne-terminy";
}

export function getAdminSlotPlannerHref(
  area: AdminArea,
  options?: {
    week?: string;
    day?: string;
    status?: string;
    panel?: SlotPlannerPanel;
    slot?: string;
    flash?: string;
  },
) {
  const params = new URLSearchParams();

  if (options?.week) {
    params.set("week", options.week);
  }

  if (options?.day) {
    params.set("day", options.day);
  }

  if (options?.status && options.status !== "ALL") {
    params.set("status", options.status);
  }

  if (options?.panel && options.panel !== "day") {
    params.set("panel", options.panel);
  }

  if (options?.slot) {
    params.set("slot", options.slot);
  }

  if (options?.flash) {
    params.set("flash", options.flash);
  }

  const query = params.toString();
  return query ? `${getAdminSlotListHref(area)}?${query}` : getAdminSlotListHref(area);
}

export function getAdminSlotCreateHref(area: AdminArea) {
  return `${getAdminSlotListHref(area)}/novy`;
}

export function getAdminSlotDetailHref(area: AdminArea, slotId: string) {
  return `${getAdminSlotListHref(area)}/${slotId}`;
}

export function getAdminSlotEditHref(area: AdminArea, slotId: string) {
  return `${getAdminSlotDetailHref(area, slotId)}/upravit`;
}

export function getAdminSlotStatusLabel(status: AvailabilitySlotStatus) {
  switch (status) {
    case AvailabilitySlotStatus.DRAFT:
      return "Rozpracovaný";
    case AvailabilitySlotStatus.PUBLISHED:
      return "Publikovaný";
    case AvailabilitySlotStatus.CANCELLED:
      return "Zrušený";
    case AvailabilitySlotStatus.ARCHIVED:
      return "Archivovaný";
  }
}

export function getSlotRestrictionModeLabel(
  mode: AvailabilitySlotServiceRestrictionMode,
  count: number,
) {
  if (mode === AvailabilitySlotServiceRestrictionMode.ANY) {
    return "Bez omezení služeb";
  }

  return count === 1 ? "Jen 1 služba" : `Jen ${count} služby`;
}

export function getSlotOccupancyLabel(activeBookingsCount: number, capacity: number) {
  if (activeBookingsCount <= 0) {
    return "Volný";
  }

  if (activeBookingsCount >= capacity) {
    return "Plný";
  }

  return "Částečně obsazený";
}

export function getSlotFlashMeta(flash?: string): SlotFlashMeta | undefined {
  switch (flash) {
    case "created":
      return {
        tone: "success",
        message: "Slot byl vytvořený.",
      };
    case "updated":
      return {
        tone: "success",
        message: "Slot byl upravený.",
      };
    case "status-updated":
      return {
        tone: "success",
        message: "Stav slotu byl změněný.",
      };
    case "deleted":
      return {
        tone: "success",
        message: "Slot byl smazaný.",
      };
    case "batch-created":
      return {
        tone: "success",
        message: "Série slotů byla vytvořená.",
      };
    case "status-error":
      return {
        tone: "error",
        message: "Stav slotu se nepodařilo změnit. Zkontrolujte pravidla slotu a zkuste to znovu.",
      };
    case "delete-error":
      return {
        tone: "error",
        message: "Slot se nepodařilo smazat. Často je na něj navázaná aktivní nebo historická rezervace.",
      };
    case "invalid-action":
      return {
        tone: "error",
        message: "Požadovaná akce není platná.",
      };
    default:
      return undefined;
  }
}

function normalizeText(value?: string) {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}

export function parseSlotDateInput(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AdminSlotError("Zadejte platné datum a čas.", {
      startsAt: "Zadejte platné datum a čas.",
      endsAt: "Zadejte platné datum a čas.",
    });
  }

  return parsed;
}

export function parseSlotDayAndTime(day: Date, timeInput: string) {
  if (!/^\d{2}:\d{2}$/.test(timeInput)) {
    throw new AdminSlotError("Zadejte platný čas.", {
      startTime: "Zadejte platný čas.",
    });
  }

  const [hours, minutes] = timeInput.split(":").map(Number);
  const parsed = new Date(day);
  parsed.setHours(hours, minutes, 0, 0);

  if (Number.isNaN(parsed.getTime())) {
    throw new AdminSlotError("Zadejte platný čas.", {
      startTime: "Zadejte platný čas.",
    });
  }

  return parsed;
}

function getDayState(daySlots: AdminSlotPlannerSlot[]) {
  if (daySlots.length === 0) {
    return {
      tone: "empty" as const,
      label: "Prázdný den",
      summary: "Bez slotů",
    };
  }

  const hasBookableSlot = daySlots.some(
    (slot) => slot.status === AvailabilitySlotStatus.PUBLISHED && slot.freeCapacity > 0,
  );
  const allClosed = daySlots.every(
    (slot) =>
      slot.status === AvailabilitySlotStatus.CANCELLED || slot.status === AvailabilitySlotStatus.ARCHIVED,
  );

  if (allClosed) {
    return {
      tone: "cancelled" as const,
      label: "Zrušený den",
      summary: "Všechny sloty jsou stažené nebo archivované",
    };
  }

  if (hasBookableSlot) {
    return {
      tone: "active" as const,
      label: "Aktivní den",
      summary: "Jsou k dispozici sloty k rezervaci",
    };
  }

  return {
    tone: "limited" as const,
    label: "Omezený den",
    summary: "Den potřebuje kontrolu nebo úpravu",
  };
}

function getSuggestedStartsAt(day: Date, slots: AdminSlotPlannerSlot[]) {
  if (slots.length === 0) {
    const suggested = new Date(day);
    suggested.setHours(9, 0, 0, 0);
    return suggested;
  }

  const lastSlot = slots[slots.length - 1];
  const suggested = new Date(lastSlot.endsAtInput);
  suggested.setMinutes(suggested.getMinutes() + 15);

  if (toDateKey(suggested) !== toDateKey(day)) {
    const fallback = new Date(day);
    fallback.setHours(9, 0, 0, 0);
    return fallback;
  }

  return suggested;
}

function buildPlannerDay(day: Date, slots: AdminSlotPlannerSlot[]): AdminSlotPlannerDay {
  const publishedCount = slots.filter((slot) => slot.status === AvailabilitySlotStatus.PUBLISHED).length;
  const freeCount = slots.filter(
    (slot) => slot.status === AvailabilitySlotStatus.PUBLISHED && slot.freeCapacity > 0,
  ).length;
  const occupiedCount = slots.filter(
    (slot) => slot.status === AvailabilitySlotStatus.PUBLISHED && slot.freeCapacity === 0,
  ).length;
  const cancelledCount = slots.filter((slot) => slot.status === AvailabilitySlotStatus.CANCELLED).length;
  const draftCount = slots.filter((slot) => slot.status === AvailabilitySlotStatus.DRAFT).length;
  const archivedCount = slots.filter((slot) => slot.status === AvailabilitySlotStatus.ARCHIVED).length;
  const state = getDayState(slots);
  const suggestedStartsAt = getSuggestedStartsAt(day, slots);
  const suggestedEndsAt = new Date(suggestedStartsAt);
  suggestedEndsAt.setMinutes(suggestedEndsAt.getMinutes() + 60);
  const defaultWindow = getDefaultAvailabilityWindowForDay(day);

  return {
    dateKey: toDateKey(day),
    dateLabel: formatDateLong.format(day),
    weekdayShortLabel: getWeekdayShortLabel(day),
    weekdayLabel: getWeekdayLongLabel(day),
    headingLabel: `${getWeekdayShortLabel(day)} ${getMonthDayLabel(day)}`,
    stateLabel: state.label,
    stateTone: state.tone,
    summaryLabel: state.summary,
    timeRangeLabel:
      slots.length > 0 ? `${slots[0].startsAtLabel} - ${slots[slots.length - 1].endsAtLabel}` : "Bez slotů",
    availabilityWindowLabel: formatTimeRange(defaultWindow.start, defaultWindow.end),
    availabilityWindowHint:
      slots.length > 0
        ? "Zelené bloky nahoře ukazují ručně zadanou dostupnost pro tento den."
        : "Připraveno pro budoucí fill-time job. Výchozí okno je zatím jen referenční 8:00–18:00.",
    slotCount: slots.length,
    publishedCount,
    freeCount,
    occupiedCount,
    cancelledCount,
    draftCount,
    archivedCount,
    suggestedStartsAtInput: getDateInputValue(suggestedStartsAt),
    suggestedEndsAtInput: getDateInputValue(suggestedEndsAt),
    slots,
  };
}

export function parseAdminSlotFilters(input: AdminSlotFilterInput) {
  const normalizedStatus = input.status?.trim().toUpperCase();
  const status =
    normalizedStatus &&
    Object.values(AvailabilitySlotStatus).includes(normalizedStatus as AvailabilitySlotStatus)
      ? (normalizedStatus as AvailabilitySlotStatus)
      : undefined;

  const rawWeek = parseDateOnlyInput(input.week);
  const rawDay = parseDateOnlyInput(input.day);
  const baseDate = rawWeek ?? rawDay ?? new Date();
  const weekStart = getStartOfWeek(baseDate);
  const weekEnd = addDays(weekStart, 7);
  const selectedDayDate = rawDay && rawDay >= weekStart && rawDay < weekEnd ? rawDay : new Date(weekStart);
  const normalizedPanel = input.panel?.trim().toLowerCase();
  const panelInput: SlotPlannerPanel =
    normalizedPanel === "create" || normalizedPanel === "batch" ? normalizedPanel : "day";
  const slotInput = input.slot?.trim() || undefined;

  return {
    startsAtGte: weekStart,
    startsAtLt: weekEnd,
    weekStart,
    weekEnd,
    weekInput: toDateKey(weekStart),
    dayInput: toDateKey(selectedDayDate),
    selectedDayDate,
    status,
    statusInput: status ?? "ALL",
    panelInput,
    slotInput,
    flash: getSlotFlashMeta(input.flash),
  };
}

export async function getAdminSlotFormData(slotId?: string) {
  const [services, slot] = await Promise.all([
    listActiveServicesForSlotForm(),
    slotId ? getSlotDetailById(slotId) : Promise.resolve(null),
  ]);

  if (slotId && !slot) {
    return null;
  }

  return {
    services,
    slot: slot
      ? {
          id: slot.id,
          startsAtInput: getDateInputValue(slot.startsAt),
          endsAtInput: getDateInputValue(slot.endsAt),
          capacity: slot.capacity,
          status: slot.status,
          serviceRestrictionMode: slot.serviceRestrictionMode,
          publicNote: slot.publicNote ?? "",
          internalNote: slot.internalNote ?? "",
          serviceIds: slot.allowedServices.map((service) => service.service.id),
          activeBookingsCount: slot.bookings.filter((booking) => isActiveBookingStatus(booking.status))
            .length,
        }
      : null,
  };
}

export async function getAdminSlotListData(area: AdminArea, filters: AdminSlotFilterInput): Promise<AdminSlotPlannerData> {
  const parsed = parseAdminSlotFilters(filters);
  const slots = await listAdminSlots({
    startsAtGte: parsed.startsAtGte,
    startsAtLt: parsed.startsAtLt,
    status: parsed.status,
  });

  const groupedSlots = new Map<string, AdminSlotPlannerSlot[]>();

  for (const slot of slots) {
    const activeBookings = slot.bookings.filter((booking) => isActiveBookingStatus(booking.status));
    const dateKey = toDateKey(slot.startsAt);
    const daySlots = groupedSlots.get(dateKey) ?? [];

    daySlots.push({
      id: slot.id,
      startsAtInput: getDateInputValue(slot.startsAt),
      endsAtInput: getDateInputValue(slot.endsAt),
      startsAtLabel: formatTime.format(slot.startsAt),
      endsAtLabel: formatTime.format(slot.endsAt),
      timeRangeLabel: `${formatTime.format(slot.startsAt)} - ${formatTime.format(slot.endsAt)}`,
      timeShortLabel: formatTime.format(slot.startsAt),
      statusLabel: getAdminSlotStatusLabel(slot.status),
      status: slot.status,
      occupancyLabel: getSlotOccupancyLabel(activeBookings.length, slot.capacity),
      activeBookingsCount: activeBookings.length,
      totalBookingsCount: slot.bookings.length,
      capacity: slot.capacity,
      freeCapacity: Math.max(slot.capacity - activeBookings.length, 0),
      restrictionLabel: getSlotRestrictionModeLabel(
        slot.serviceRestrictionMode,
        slot.allowedServices.length,
      ),
      serviceRestrictionMode: slot.serviceRestrictionMode,
      serviceIds: slot.allowedServices.map((allowedService) => allowedService.service.id),
      allowedServiceNames: slot.allowedServices.map((allowedService) => allowedService.service.name),
      publicNote: slot.publicNote,
      internalNote: slot.internalNote,
      createdByLabel: slot.createdByUser?.name ?? "Neznámý admin",
      canDelete: slot.bookings.length === 0,
      hasActiveBookings: activeBookings.length > 0,
    });

    groupedSlots.set(dateKey, daySlots);
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(parsed.weekStart, index);
    return buildPlannerDay(day, groupedSlots.get(toDateKey(day)) ?? []);
  });

  const selectedDay =
    days.find((day) => day.dateKey === parsed.dayInput) ??
    days.find((day) => day.dateKey === toDateKey(new Date())) ??
    days[0];
  const selectedSlot =
    selectedDay.slots.find((slot) => slot.id === parsed.slotInput) ?? selectedDay.slots[0] ?? null;

  const allWeekSlots = days.flatMap((day) => day.slots);

  return {
    area,
    filters: {
      weekInput: parsed.weekInput,
      dayInput: selectedDay.dateKey,
      statusInput: parsed.statusInput,
      panelInput: parsed.panelInput,
      slotInput: selectedSlot?.id,
      flash: parsed.flash,
    },
    weekLabel: `${formatDateLong.format(parsed.weekStart)} - ${formatDateLong.format(addDays(parsed.weekStart, 6))}`,
    days,
    selectedDay,
    selectedSlot,
    stats: {
      total: allWeekSlots.length,
      published: allWeekSlots.filter((slot) => slot.status === AvailabilitySlotStatus.PUBLISHED).length,
      free: allWeekSlots.filter(
        (slot) => slot.status === AvailabilitySlotStatus.PUBLISHED && slot.freeCapacity > 0,
      ).length,
      occupied: allWeekSlots.filter(
        (slot) => slot.status === AvailabilitySlotStatus.PUBLISHED && slot.freeCapacity === 0,
      ).length,
      emptyDays: days.filter((day) => day.slotCount === 0).length,
    },
  };
}

export async function getAdminSlotDetailData(area: AdminArea, slotId: string) {
  const slot = await getSlotDetailById(slotId);

  if (!slot) {
    return null;
  }

  const activeBookings = slot.bookings.filter((booking) => isActiveBookingStatus(booking.status));
  const hasAnyBookings = slot.bookings.length > 0;

  return {
    id: slot.id,
    area,
    title: `${formatDateTimeLabel(slot.startsAt)} - ${formatTime.format(slot.endsAt)}`,
    status: slot.status,
    statusLabel: getAdminSlotStatusLabel(slot.status),
    occupancyLabel: getSlotOccupancyLabel(activeBookings.length, slot.capacity),
    startsAtLabel: formatDateTimeLabel(slot.startsAt),
    endsAtLabel: formatDateTimeLabel(slot.endsAt),
    createdAtLabel: formatDateTimeLabel(slot.createdAt),
    updatedAtLabel: formatDateTimeLabel(slot.updatedAt),
    publishedAtLabel: formatDateTimeLabel(slot.publishedAt),
    cancelledAtLabel: formatDateTimeLabel(slot.cancelledAt),
    capacity: slot.capacity,
    activeBookingsCount: activeBookings.length,
    freeCapacity: Math.max(slot.capacity - activeBookings.length, 0),
    restrictionLabel: getSlotRestrictionModeLabel(
      slot.serviceRestrictionMode,
      slot.allowedServices.length,
    ),
    publicNote: slot.publicNote,
    internalNote: slot.internalNote,
    allowedServices: slot.allowedServices.map((allowedService) => ({
      id: allowedService.service.id,
      name: allowedService.service.name,
      durationMinutes: allowedService.service.durationMinutes,
      isActive: allowedService.service.isActive,
    })),
    bookings: slot.bookings.map((booking) => ({
      id: booking.id,
      clientName: booking.clientNameSnapshot,
      serviceName: booking.serviceNameSnapshot,
      status: booking.status,
      statusLabel: getBookingStatusLabel(booking.status),
      scheduledAtLabel: `${formatDateTimeLabel(booking.scheduledStartsAt)} - ${formatTime.format(booking.scheduledEndsAt)}`,
    })),
    createdByLabel: slot.createdByUser?.name ?? "Neznámý admin",
    canDelete: !hasAnyBookings,
    deleteBlockedReason:
      activeBookings.length > 0
        ? "Slot má navázanou aktivní rezervaci, takže ho nelze smazat."
        : hasAnyBookings
          ? "Slot má historickou rezervaci, takže ho z bezpečnostních důvodů nemažeme. Použij archivaci."
          : null,
  };
}

function getBookingStatusLabel(status: BookingStatus) {
  switch (status) {
    case BookingStatus.PENDING:
      return "Čeká";
    case BookingStatus.CONFIRMED:
      return "Potvrzená";
    case BookingStatus.CANCELLED:
      return "Zrušená";
    case BookingStatus.COMPLETED:
      return "Dokončená";
    case BookingStatus.NO_SHOW:
      return "Nedorazila";
  }
}

async function validateSlotPayload(
  input: AdminSlotFormInput,
  options?: {
    slotId?: string;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const fieldErrors: Record<string, string> = {};

  if (input.endsAt <= input.startsAt) {
    fieldErrors.endsAt = "Konec slotu musí být později než začátek.";
  }

  if (input.capacity < 1) {
    fieldErrors.capacity = "Kapacita musí být alespoň 1.";
  }

  const uniqueServiceIds = [...new Set(input.serviceIds)];

  if (
    input.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.SELECTED &&
    uniqueServiceIds.length === 0
  ) {
    fieldErrors.serviceIds = "Vyberte alespoň jednu službu nebo přepněte slot na režim bez omezení.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new AdminSlotError("Formulář potřebuje opravit.", fieldErrors);
  }

  const [services, overlap, existingSlot] = await Promise.all([
    getServicesByIds(uniqueServiceIds, db),
    findSlotOverlap(
      {
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        excludeSlotId: options?.slotId,
      },
      db,
    ),
    options?.slotId ? getSlotForWrite(options.slotId, db) : Promise.resolve(null),
  ]);

  if (uniqueServiceIds.length !== services.length) {
    throw new AdminSlotError("Některá ze zvolených služeb už neexistuje.", {
      serviceIds: "Některá ze zvolených služeb už neexistuje.",
    });
  }

  if (services.some((service) => !service.isActive)) {
    throw new AdminSlotError("Slot lze omezit jen na aktivní služby.", {
      serviceIds: "Slot lze omezit jen na aktivní služby.",
    });
  }

  if (overlap) {
    throw new AdminSlotError(
      `Slot koliduje s jiným aktivním slotem (${formatDateTimeLabel(overlap.startsAt)} - ${formatTime.format(overlap.endsAt)}).`,
      {
        startsAt: "Termín koliduje s jiným aktivním slotem.",
        endsAt: "Termín koliduje s jiným aktivním slotem.",
      },
    );
  }

  if (existingSlot) {
    const activeBookings = existingSlot.bookings.filter((booking) => isActiveBookingStatus(booking.status));

    if (input.capacity < activeBookings.length) {
      throw new AdminSlotError("Kapacitu nelze snížit pod počet aktivních rezervací.", {
        capacity: "Kapacitu nelze snížit pod počet aktivních rezervací.",
      });
    }

    if (input.status === AvailabilitySlotStatus.ARCHIVED && activeBookings.length > 0) {
      throw new AdminSlotError("Slot s aktivní rezervací nejde archivovat.", {
        status: "Slot s aktivní rezervací nejde archivovat.",
      });
    }

    if (
      input.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.SELECTED &&
      activeBookings.some((booking) => !uniqueServiceIds.includes(booking.serviceId))
    ) {
      throw new AdminSlotError(
        "Vybrané služby už neodpovídají aktivní rezervaci navázané na tento slot.",
        {
          serviceIds: "Vybrané služby musí pokrýt i aktivní rezervace navázané na tento slot.",
        },
      );
    }
  }

  return {
    uniqueServiceIds,
  };
}

function isOverlapConstraintError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  const message = `${error.message} ${JSON.stringify(error.meta ?? {})}`;
  return error.code === "P2004" && message.includes("AvailabilitySlot_active_time_window_excl");
}

async function persistSlot(
  input: PersistSlotInput,
  options?: {
    slotId?: string;
  },
) {
  const normalizedPublicNote = normalizeText(input.publicNote);
  const normalizedInternalNote = normalizeText(input.internalNote);

  try {
    return await prisma.$transaction(async (tx) => {
      const validated = await validateSlotPayload(
        {
          ...input,
          publicNote: normalizedPublicNote,
          internalNote: normalizedInternalNote,
        },
        options,
        tx,
      );
      const publishedAt = input.status === AvailabilitySlotStatus.PUBLISHED ? new Date() : null;
      const cancelledAt = input.status === AvailabilitySlotStatus.CANCELLED ? new Date() : null;

      if (options?.slotId) {
        await updateSlotRecord(
          options.slotId,
          {
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            capacity: input.capacity,
            status: input.status,
            serviceRestrictionMode: input.serviceRestrictionMode,
            publicNote: normalizedPublicNote ?? null,
            internalNote: normalizedInternalNote ?? null,
            publishedAt,
            cancelledAt,
            allowedServices: {
              deleteMany: {},
              create:
                input.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.SELECTED
                  ? validated.uniqueServiceIds.map((serviceId) => ({
                      service: {
                        connect: {
                          id: serviceId,
                        },
                      },
                    }))
                  : [],
            },
          },
          tx,
        );

        return { id: options.slotId };
      }

      return createSlotRecord(
        {
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          capacity: input.capacity,
          status: input.status,
          serviceRestrictionMode: input.serviceRestrictionMode,
          publicNote: normalizedPublicNote ?? null,
          internalNote: normalizedInternalNote ?? null,
          publishedAt,
          cancelledAt,
          createdByUser: {
            connect: {
              id: input.actorUserId,
            },
          },
          allowedServices:
            input.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.SELECTED
              ? {
                  create: validated.uniqueServiceIds.map((serviceId) => ({
                    service: {
                      connect: {
                        id: serviceId,
                      },
                    },
                  })),
                }
              : undefined,
        },
        tx,
      );
    });
  } catch (error) {
    if (isOverlapConstraintError(error)) {
      throw new AdminSlotError("Slot koliduje s jiným aktivním slotem.", {
        startsAt: "Termín koliduje s jiným aktivním slotem.",
        endsAt: "Termín koliduje s jiným aktivním slotem.",
      });
    }

    throw error;
  }
}

export async function createAdminSlot(input: PersistSlotInput) {
  return persistSlot(input);
}

export async function createAdminSlotsBatch(input: BatchCreateSlotsInput) {
  const fieldErrors: Record<string, string> = {};

  if (input.slotCount < 1) {
    fieldErrors.slotCount = "Počet slotů musí být alespoň 1.";
  }

  if (input.slotCount > 12) {
    fieldErrors.slotCount = "V jedné sérii lze založit maximálně 12 slotů.";
  }

  if (input.slotLengthMinutes < 15) {
    fieldErrors.slotLengthMinutes = "Délka slotu musí být alespoň 15 minut.";
  }

  if (input.gapMinutes < 0) {
    fieldErrors.gapMinutes = "Mezera mezi sloty nemůže být záporná.";
  }

  if (input.capacity < 1) {
    fieldErrors.capacity = "Kapacita musí být alespoň 1.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new AdminSlotError("Sérii slotů se nepodařilo připravit.", fieldErrors);
  }

  const firstStartsAt = parseSlotDayAndTime(input.day, input.startTime);

  try {
    return await prisma.$transaction(async (tx) => {
      for (let index = 0; index < input.slotCount; index += 1) {
        const startsAt = new Date(firstStartsAt);
        startsAt.setMinutes(
          firstStartsAt.getMinutes() + index * (input.slotLengthMinutes + input.gapMinutes),
        );
        const endsAt = new Date(startsAt);
        endsAt.setMinutes(endsAt.getMinutes() + input.slotLengthMinutes);

        if (toDateKey(startsAt) !== toDateKey(input.day) || toDateKey(endsAt) !== toDateKey(input.day)) {
          throw new AdminSlotError(
            "Série přesahuje do dalšího dne. Zkraťte délku, počet slotů nebo mezeru mezi nimi.",
            {
              slotCount: "Série přesahuje do dalšího dne.",
            },
          );
        }

        await validateSlotPayload(
          {
            startsAt,
            endsAt,
            capacity: input.capacity,
            status: input.status,
            serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
            publicNote: undefined,
            internalNote: undefined,
            serviceIds: [],
          },
          undefined,
          tx,
        );

        await createSlotRecord(
          {
            startsAt,
            endsAt,
            capacity: input.capacity,
            status: input.status,
            serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
            publicNote: null,
            internalNote: null,
            publishedAt: input.status === AvailabilitySlotStatus.PUBLISHED ? new Date() : null,
            cancelledAt: input.status === AvailabilitySlotStatus.CANCELLED ? new Date() : null,
            createdByUser: {
              connect: {
                id: input.actorUserId,
              },
            },
          },
          tx,
        );
      }

      return { count: input.slotCount };
    });
  } catch (error) {
    if (isOverlapConstraintError(error)) {
      throw new AdminSlotError("Některý z nových slotů koliduje s existujícím termínem.", {
        startTime: "Série koliduje s jiným aktivním slotem.",
      });
    }

    throw error;
  }
}

export async function updateAdminSlot(slotId: string, input: PersistSlotInput) {
  return persistSlot(input, { slotId });
}

export async function updateAdminSlotStatus(slotId: string, nextStatus: AvailabilitySlotStatus) {
  const slot = await getSlotForWrite(slotId);

  if (!slot) {
    throw new AdminSlotError("Slot se nepodařilo najít.");
  }

  const activeBookings = slot.bookings.filter((booking) => isActiveBookingStatus(booking.status));

  if (nextStatus === AvailabilitySlotStatus.ARCHIVED && activeBookings.length > 0) {
    throw new AdminSlotError("Slot s aktivní rezervací nejde archivovat.");
  }

  const now = new Date();

  await updateSlotRecord(slotId, {
    status: nextStatus,
    publishedAt: nextStatus === AvailabilitySlotStatus.PUBLISHED ? now : slot.publishedAt,
    cancelledAt: nextStatus === AvailabilitySlotStatus.CANCELLED ? now : null,
  });
}

export async function deleteAdminSlot(slotId: string) {
  const slot = await getSlotForWrite(slotId);

  if (!slot) {
    throw new AdminSlotError("Slot se nepodařilo najít.");
  }

  const activeBookings = slot.bookings.filter((booking) => isActiveBookingStatus(booking.status));

  if (activeBookings.length > 0) {
    throw new AdminSlotError("Slot má aktivní rezervaci, takže ho nelze smazat.");
  }

  if (slot.bookings.length > 0) {
    throw new AdminSlotError(
      "Slot má historické rezervace, takže ho z bezpečnostních důvodů nemažeme. Použijte archivaci.",
    );
  }

  await deleteSlotRecord(slotId);
}
