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

const formatTime = new Intl.DateTimeFormat("cs-CZ", {
  hour: "2-digit",
  minute: "2-digit",
});

export const activeBookingStatuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;

function isActiveBookingStatus(status: BookingStatus) {
  return activeBookingStatuses.includes(status as (typeof activeBookingStatuses)[number]);
}

export type AdminSlotFilterInput = {
  date?: string;
  status?: string;
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

export class AdminSlotError extends Error {
  fieldErrors?: Record<string, string>;

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AdminSlotError";
    this.fieldErrors = fieldErrors;
  }
}

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

export function getAdminSlotListHref(area: AdminArea) {
  return area === "owner" ? "/admin/volne-terminy" : "/admin/provoz/volne-terminy";
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
      return "Blokovaný";
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
    return "Obsazený";
  }

  return "Částečně obsazený";
}

export function getSlotFlashMessage(flash?: string) {
  switch (flash) {
    case "created":
      return "Slot byl vytvořený.";
    case "updated":
      return "Slot byl upravený.";
    case "status-updated":
      return "Stav slotu byl změněný.";
    case "deleted":
      return "Slot byl smazaný.";
    default:
      return undefined;
  }
}

function normalizeText(value?: string) {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized ? normalized : undefined;
}

function getDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

export function parseAdminSlotFilters(input: AdminSlotFilterInput) {
  const normalizedStatus = input.status?.trim().toUpperCase();
  const status =
    normalizedStatus &&
    Object.values(AvailabilitySlotStatus).includes(normalizedStatus as AvailabilitySlotStatus)
      ? (normalizedStatus as AvailabilitySlotStatus)
      : undefined;

  const date =
    input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? new Date(`${input.date}T00:00:00`) : undefined;

  return {
    date,
    dateInput: input.date ?? "",
    status,
    statusInput: status ?? "ALL",
    flashMessage: getSlotFlashMessage(input.flash),
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

export async function getAdminSlotListData(area: AdminArea, filters: AdminSlotFilterInput) {
  const parsed = parseAdminSlotFilters(filters);
  const slots = await listAdminSlots({
    date: parsed.date,
    status: parsed.status,
  });

  return {
    area,
    filters: parsed,
    slots: slots.map((slot) => {
      const activeBookings = slot.bookings.filter((booking) => isActiveBookingStatus(booking.status));

      return {
        id: slot.id,
        startsAtLabel: formatDateTimeLabel(slot.startsAt),
        endsAtLabel: formatTime.format(slot.endsAt),
        dateLabel: formatDateLabel(slot.startsAt),
        statusLabel: getAdminSlotStatusLabel(slot.status),
        status: slot.status,
        occupancyLabel: getSlotOccupancyLabel(activeBookings.length, slot.capacity),
        activeBookingsCount: activeBookings.length,
        capacity: slot.capacity,
        restrictionLabel: getSlotRestrictionModeLabel(
          slot.serviceRestrictionMode,
          slot.allowedServices.length,
        ),
        allowedServiceNames: slot.allowedServices.map((allowedService) => allowedService.service.name),
        publicNote: slot.publicNote,
        internalNote: slot.internalNote,
        createdByLabel: slot.createdByUser?.name ?? "Neznámý admin",
      };
    }),
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
    getServicesByIds(uniqueServiceIds),
    findSlotOverlap({
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      excludeSlotId: options?.slotId,
    }),
    options?.slotId ? getSlotForWrite(options.slotId) : Promise.resolve(null),
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
    const activeBookings = existingSlot.bookings.filter((booking) =>
      isActiveBookingStatus(booking.status),
    );

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
  const validated = await validateSlotPayload(input, options);
  const publishedAt = input.status === AvailabilitySlotStatus.PUBLISHED ? new Date() : null;
  const cancelledAt = input.status === AvailabilitySlotStatus.CANCELLED ? new Date() : null;

  try {
    return await prisma.$transaction(async (tx) => {
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
