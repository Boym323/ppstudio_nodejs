"use server";

import { BookingSource, BookingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type AdminArea } from "@/config/navigation";
import { type CreateManualBookingActionState } from "@/features/admin/actions/create-manual-booking-action-state";
import { type RescheduleBookingActionState } from "@/features/admin/actions/reschedule-booking-action-state";
import { type UpdateBookingNoteActionState } from "@/features/admin/actions/update-booking-note-action-state";
import { type UpdateBookingStatusActionState } from "@/features/admin/actions/update-booking-status-action-state";
import {
  applyAdminBookingStatusChange,
  canApplyAdminBookingTransition,
  getAdminBookingActionOptions,
  getBookingStatusLabel,
  type AdminBookingActionValue,
  updateAdminBookingInternalNote,
} from "@/features/admin/lib/admin-booking";
import {
  createManualBooking,
  isValidNormalizedClientPhone,
  normalizeClientPhone,
  PublicBookingError,
} from "@/features/booking/lib/booking-public";
import {
  bookingRescheduleErrorCodes,
  BookingRescheduleError,
  rescheduleBooking,
} from "@/features/booking/lib/booking-rescheduling";
import { resolvePragueLocalDateTime } from "@/features/booking/lib/booking-local-time";
import { requireAdminArea } from "@/lib/auth/session";
import { sendOwnerBookingPushover } from "@/lib/notifications/pushover";
import { prisma } from "@/lib/prisma";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

const updateBookingStatusSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  targetStatus: z
    .string()
    .trim()
    .min(1, "Vyberte, co se má s rezervací stát.")
    .refine(
      (value): value is AdminBookingActionValue =>
        [
          BookingStatus.CONFIRMED,
          BookingStatus.COMPLETED,
          BookingStatus.CANCELLED,
          BookingStatus.NO_SHOW,
        ].includes(value as AdminBookingActionValue),
      "Vyberte platnou akci pro rezervaci.",
    ),
  reason: z.string().trim().max(160, "Důvod je příliš dlouhý.").optional().or(z.literal("")),
  internalNote: z
    .string()
    .trim()
    .max(1000, "Interní poznámka je příliš dlouhá.")
    .optional()
    .or(z.literal("")),
});

const updateBookingNoteSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  internalNote: z.string().trim().max(1000, "Interní poznámka je příliš dlouhá."),
});

const createManualBookingSchema = z.object({
  area: z.enum(["owner", "salon"]),
  selectionMode: z.enum(["slot", "manual"]),
  selectedClientId: z.string().trim().max(64).optional().or(z.literal("")),
  serviceId: z.string().trim().min(1, "Vyberte službu.").max(64),
  slotId: z.string().trim().max(64).optional().or(z.literal("")),
  startsAt: z.string().trim().optional().or(z.literal("")),
  manualDate: z.string().trim().optional().or(z.literal("")),
  manualTime: z.string().trim().optional().or(z.literal("")),
  fullName: z
    .string()
    .trim()
    .min(3, "Zadejte jméno a příjmení klientky.")
    .max(120, "Jméno je příliš dlouhé."),
  email: z.email("Zadejte platný e-mail.").max(254, "E-mail je příliš dlouhý."),
  phone: z
    .string()
    .trim()
    .max(32, "Telefon je příliš dlouhý.")
    .refine((value) => value.length === 0 || isValidNormalizedClientPhone(normalizeClientPhone(value)), {
      message: "Telefon zadejte s 8 až 15 číslicemi, případně s úvodním +.",
    })
    .optional()
    .or(z.literal("")),
  clientProfileNote: z.string().trim().max(500, "Poznámka ke klientce je příliš dlouhá.").optional().or(z.literal("")),
  clientNote: z.string().trim().max(600, "Poznámka pro rezervaci je příliš dlouhá.").optional().or(z.literal("")),
  internalNote: z.string().trim().max(1000, "Interní poznámka je příliš dlouhá.").optional().or(z.literal("")),
  source: z.nativeEnum(BookingSource),
  bookingStatus: z
    .string()
    .trim()
    .refine(
      (value): value is "PENDING" | "CONFIRMED" =>
        value === BookingStatus.PENDING || value === BookingStatus.CONFIRMED,
      "Vyberte stav rezervace.",
    ),
  includeCalendarAttachment: z.enum(["0", "1"]).optional().default("0"),
  submitMode: z.enum(["create", "create-and-send"]),
});

const rescheduleBookingSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  selectionMode: z.enum(["slot", "manual"]),
  slotId: z.string().trim().max(64).optional().or(z.literal("")),
  startsAt: z.string().trim().optional().or(z.literal("")),
  manualDate: z.string().trim().optional().or(z.literal("")),
  manualTime: z.string().trim().optional().or(z.literal("")),
  expectedUpdatedAt: z.string().trim().min(1).max(64),
  reason: z.string().trim().max(300, "Důvod změny je příliš dlouhý.").optional().or(z.literal("")),
  notifyClient: z.enum(["0", "1"]).optional().default("1"),
  includeCalendarAttachment: z.enum(["0", "1"]).optional().default("1"),
});

function revalidateBookingAdminPaths(bookingId: string) {
  const paths = [
    "/admin",
    "/admin/rezervace",
    `/admin/rezervace/${bookingId}`,
    "/admin/provoz",
    "/admin/provoz/rezervace",
    `/admin/provoz/rezervace/${bookingId}`,
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
}

async function resolveBookingActorUserId(area: AdminArea) {
  const session = await requireAdminArea(area);
  const dbUser = await prisma.adminUser.findFirst({
    where: {
      email: {
        equals: session.email.trim(),
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  return dbUser?.id ?? null;
}

function resolveManualStartsAt(dateValue: string, timeValue: string) {
  return resolvePragueLocalDateTime(dateValue, timeValue);
}

function revalidateManualBookingPaths(bookingId: string, clientId?: string) {
  revalidateBookingAdminPaths(bookingId);
  revalidatePath("/rezervace");
  revalidatePath("/admin/volne-terminy");
  revalidatePath("/admin/provoz/volne-terminy");

  if (clientId) {
    revalidatePath(`/admin/klienti/${clientId}`);
    revalidatePath(`/admin/provoz/klienti/${clientId}`);
  }
}

export async function updateBookingStatusAction(
  _previousState: UpdateBookingStatusActionState,
  formData: FormData,
): Promise<UpdateBookingStatusActionState> {
  const parsed = updateBookingStatusSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    targetStatus: readFormString(formData, "targetStatus"),
    reason: readFormString(formData, "reason"),
    internalNote: readFormString(formData, "internalNote"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      fieldErrors: {
        targetStatus: fieldErrors.targetStatus?.[0],
        reason: fieldErrors.reason?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const actorUserId = await resolveBookingActorUserId(area);
  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!booking) {
    return {
      status: "error",
      formError: "Rezervaci se nepodařilo najít.",
    };
  }

  if (!canApplyAdminBookingTransition(booking.status, parsed.data.targetStatus)) {
    const availableActions = getAdminBookingActionOptions(booking.status);

    return {
      status: "error",
      formError:
        availableActions.length > 0
          ? `Z této rezervace teď můžeš udělat jen: ${availableActions
              .map((action) => action.label.toLowerCase())
              .join(", ")}.`
          : `Rezervace je ve stavu „${getBookingStatusLabel(booking.status)}“ a další změna už není dostupná.`,
    };
  }

  const result = await applyAdminBookingStatusChange({
    bookingId: parsed.data.bookingId,
    targetStatus: parsed.data.targetStatus as AdminBookingActionValue,
    actorUserId,
    reason: parsed.data.reason || undefined,
    internalNote: parsed.data.internalNote || undefined,
  });

  if (result.status === "not-found") {
    return {
      status: "error",
      formError: "Rezervaci se nepodařilo najít.",
    };
  }

  if (result.status === "invalid-transition") {
    return {
      status: "error",
      formError: `Rezervace už mezitím přešla do stavu „${getBookingStatusLabel(result.currentStatus)}“.`,
    };
  }

  if (
    parsed.data.targetStatus === BookingStatus.CONFIRMED
    || parsed.data.targetStatus === BookingStatus.CANCELLED
  ) {
    await sendOwnerBookingPushover({
      type:
        parsed.data.targetStatus === BookingStatus.CONFIRMED
          ? "BOOKING_CONFIRMED"
          : "BOOKING_CANCELLED",
      bookingId: parsed.data.bookingId,
      sourceLabel: "Admin",
    });
  }

  revalidateBookingAdminPaths(parsed.data.bookingId);

  return {
    status: "success",
    successMessage: "Změna byla uložená a propsala se i do historie rezervace.",
  };
}

export async function updateBookingNoteAction(
  _previousState: UpdateBookingNoteActionState,
  formData: FormData,
): Promise<UpdateBookingNoteActionState> {
  const parsed = updateBookingNoteSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    internalNote: readFormString(formData, "internalNote"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Poznámku se nepodařilo uložit.",
      fieldErrors: {
        internalNote: fieldErrors.internalNote?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const actorUserId = await resolveBookingActorUserId(area);
  const result = await updateAdminBookingInternalNote({
    bookingId: parsed.data.bookingId,
    actorUserId,
    internalNote: parsed.data.internalNote || null,
  });

  if (result.status === "not-found") {
    return {
      status: "error",
      formError: "Rezervaci se nepodařilo najít.",
    };
  }

  revalidateBookingAdminPaths(parsed.data.bookingId);

  return {
    status: "success",
    successMessage: parsed.data.internalNote
      ? "Interní poznámka je uložená."
      : "Interní poznámka byla odstraněná.",
  };
}

export async function createManualBookingAction(
  _previousState: CreateManualBookingActionState,
  formData: FormData,
): Promise<CreateManualBookingActionState> {
  const parsed = createManualBookingSchema.safeParse({
    area: readFormString(formData, "area"),
    selectionMode: readFormString(formData, "selectionMode"),
    selectedClientId: readFormString(formData, "selectedClientId"),
    serviceId: readFormString(formData, "serviceId"),
    slotId: readFormString(formData, "slotId"),
    startsAt: readFormString(formData, "startsAt"),
    manualDate: readFormString(formData, "manualDate"),
    manualTime: readFormString(formData, "manualTime"),
    fullName: readFormString(formData, "fullName"),
    email: readFormString(formData, "email"),
    phone: readFormString(formData, "phone"),
    clientProfileNote: readFormString(formData, "clientProfileNote"),
    clientNote: readFormString(formData, "clientNote"),
    internalNote: readFormString(formData, "internalNote"),
    source: readFormString(formData, "source"),
    bookingStatus: readFormString(formData, "bookingStatus"),
    includeCalendarAttachment: readFormString(formData, "includeCalendarAttachment") || "0",
    submitMode: readFormString(formData, "submitMode"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      fieldErrors: {
        serviceId: fieldErrors.serviceId?.[0],
        slotId: fieldErrors.slotId?.[0],
        manualDate: fieldErrors.manualDate?.[0],
        manualTime: fieldErrors.manualTime?.[0],
        fullName: fieldErrors.fullName?.[0],
        email: fieldErrors.email?.[0],
        phone: fieldErrors.phone?.[0],
        source: fieldErrors.source?.[0],
        bookingStatus: fieldErrors.bookingStatus?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const actorUserId = await resolveBookingActorUserId(area);
  const startsAt =
    parsed.data.selectionMode === "slot"
      ? parsed.data.startsAt
      : resolveManualStartsAt(parsed.data.manualDate || "", parsed.data.manualTime || "")?.toISOString() ?? "";

  if (!startsAt) {
    return {
      status: "error",
      formError:
        parsed.data.selectionMode === "slot"
          ? "Vyberte konkrétní slot z dostupných termínů."
          : "Vyplňte datum a čas začátku rezervace.",
      fieldErrors:
        parsed.data.selectionMode === "slot"
          ? {
              slotId: "Vyberte konkrétní slot z dostupných termínů.",
            }
          : {
              manualDate: !parsed.data.manualDate ? "Vyberte datum." : undefined,
              manualTime: !parsed.data.manualTime ? "Vyberte čas." : undefined,
            },
    };
  }

  try {
    const result = await createManualBooking({
      serviceId: parsed.data.serviceId,
      slotId: parsed.data.selectionMode === "slot" ? parsed.data.slotId || undefined : undefined,
      startsAt,
      selectedClientId: parsed.data.selectedClientId || undefined,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone || undefined,
      clientProfileNote: parsed.data.clientProfileNote || undefined,
      clientNote: parsed.data.clientNote || undefined,
      internalNote: parsed.data.internalNote || undefined,
      source: parsed.data.source,
      status: parsed.data.bookingStatus as "PENDING" | "CONFIRMED",
      actorUserId,
      sendClientEmail: parsed.data.submitMode === "create-and-send",
      includeCalendarAttachment:
        parsed.data.submitMode === "create-and-send"
        && parsed.data.includeCalendarAttachment === "1",
      deliverEmailImmediately: parsed.data.submitMode === "create-and-send",
    });
    const booking = await prisma.booking.findUnique({
      where: {
        id: result.bookingId,
      },
      select: {
        clientId: true,
      },
    });

    revalidateManualBookingPaths(result.bookingId, booking?.clientId);

    return {
      status: "success",
      createdBookingId: result.bookingId,
      successMessage:
        parsed.data.submitMode === "create-and-send"
          ? "Rezervace je vytvořená a navazující potvrzení se propsalo do emailového flow."
          : "Rezervace je vytvořená bez odbočení mimo hlavní booking engine.",
      manualOverrideWarning: result.manualOverride
        ? "Termín nebyl ve veřejné dostupnosti, takže rezervace byla uložená jako interní výjimka."
        : undefined,
    };
  } catch (error) {
    if (error instanceof PublicBookingError) {
      return {
        status: "error",
        formError: error.message,
        fieldErrors:
          error.suggestedStep === 2
            ? {
                slotId:
                  parsed.data.selectionMode === "slot"
                    ? error.message
                    : undefined,
                manualDate:
                  parsed.data.selectionMode === "manual"
                    ? error.message
                    : undefined,
                manualTime:
                  parsed.data.selectionMode === "manual"
                    ? error.message
                    : undefined,
              }
            : error.suggestedStep === 3
              ? {
                  email: error.message,
                  phone: error.message,
                }
              : undefined,
      };
    }

    console.error("Failed to create manual booking", error);

    return {
      status: "error",
      formError: "Rezervaci se teď nepodařilo vytvořit. Zkuste to prosím znovu.",
    };
  }
}

export async function rescheduleBookingAction(
  _previousState: RescheduleBookingActionState,
  formData: FormData,
): Promise<RescheduleBookingActionState> {
  const parsed = rescheduleBookingSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    selectionMode: readFormString(formData, "selectionMode"),
    slotId: readFormString(formData, "slotId"),
    startsAt: readFormString(formData, "startsAt"),
    manualDate: readFormString(formData, "manualDate"),
    manualTime: readFormString(formData, "manualTime"),
    expectedUpdatedAt: readFormString(formData, "expectedUpdatedAt"),
    reason: readFormString(formData, "reason"),
    notifyClient: readFormString(formData, "notifyClient") || "1",
    includeCalendarAttachment: readFormString(formData, "includeCalendarAttachment") || "1",
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      fieldErrors: {
        slotId: fieldErrors.slotId?.[0],
        manualDate: fieldErrors.manualDate?.[0],
        manualTime: fieldErrors.manualTime?.[0],
        reason: fieldErrors.reason?.[0],
      },
    };
  }

  const startsAt =
    parsed.data.selectionMode === "slot"
      ? parsed.data.startsAt
      : resolveManualStartsAt(parsed.data.manualDate || "", parsed.data.manualTime || "")?.toISOString() ?? "";

  if (!startsAt) {
    return {
      status: "error",
      formError:
        parsed.data.selectionMode === "slot"
          ? "Vyberte konkrétní nový slot."
          : "Vyplňte nové datum a čas rezervace.",
      fieldErrors:
        parsed.data.selectionMode === "slot"
          ? {
              slotId: "Vyberte konkrétní nový slot.",
            }
          : {
              manualDate: !parsed.data.manualDate ? "Vyberte datum." : undefined,
              manualTime: !parsed.data.manualTime ? "Vyberte čas." : undefined,
            },
    };
  }

  const area = parsed.data.area as AdminArea;
  const actorUserId = await resolveBookingActorUserId(area);

  try {
    const result = await rescheduleBooking({
      bookingId: parsed.data.bookingId,
      slotId: parsed.data.selectionMode === "slot" ? parsed.data.slotId || undefined : undefined,
      newStartAt: startsAt,
      reason: parsed.data.reason || null,
      changedByUserId: actorUserId,
      notifyClient: parsed.data.notifyClient === "1",
      includeCalendarAttachment: parsed.data.includeCalendarAttachment === "1",
      expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    });

    revalidateBookingAdminPaths(parsed.data.bookingId);

    return {
      status: "success",
      successMessage: `Termín jsme přesunuli z „${result.previousScheduledAtLabel}“ na „${result.scheduledAtLabel}“.`,
      warningMessage: [
        result.notificationStatus === "failed"
          ? "Změna termínu zůstala uložená, ale navazující e-mail se nepodařilo založit do fronty. Chyba je zalogovaná."
          : null,
        result.notificationStatus === "skipped" && parsed.data.notifyClient === "1"
          ? "Termín je přesunutý, ale klientce jsme neposílali e-mail, protože u rezervace chybí použitelný e-mail."
          : null,
        result.manualOverride
          ? "Nový termín nebyl ve veřejné dostupnosti, takže jsme ho uložili jako interní výjimku."
          : null,
      ].filter(Boolean).join(" ") || undefined,
    };
  } catch (error) {
    if (error instanceof BookingRescheduleError) {
      return {
        status: "error",
        formError: error.message,
        fieldErrors:
          error.code === bookingRescheduleErrorCodes.slotUnavailable
          || error.code === bookingRescheduleErrorCodes.slotNotAllowed
          || error.code === bookingRescheduleErrorCodes.slotTooShort
          || error.code === bookingRescheduleErrorCodes.conflict
            ? parsed.data.selectionMode === "slot"
              ? {
                  slotId: error.message,
                }
              : {
                  manualDate: error.message,
                  manualTime: error.message,
                }
            : error.code === bookingRescheduleErrorCodes.sameTerm
              || error.code === bookingRescheduleErrorCodes.invalidDateTime
                ? {
                    manualDate: parsed.data.selectionMode === "manual" ? error.message : undefined,
                    manualTime: error.message,
                  }
                : undefined,
      };
    }

    console.error("Failed to reschedule booking", error);

    return {
      status: "error",
      formError: "Přesun termínu se teď nepodařilo uložit. Zkuste to prosím znovu.",
    };
  }
}
