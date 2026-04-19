"use server";

import { BookingStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type AdminArea } from "@/config/navigation";
import { type UpdateBookingStatusActionState } from "@/features/admin/actions/update-booking-status-action-state";
import {
  applyAdminBookingStatusChange,
  canApplyAdminBookingTransition,
  getAdminBookingActionOptions,
  getBookingStatusLabel,
  type AdminBookingActionValue,
} from "@/features/admin/lib/admin-booking";
import { requireAdminArea } from "@/lib/auth/session";
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
        internalNote: fieldErrors.internalNote?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const session = await requireAdminArea(area);
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
    actorUserId: session.sub,
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

  revalidateBookingAdminPaths(parsed.data.bookingId);

  return {
    status: "success",
    successMessage: "Změna byla uložená a propsala se i do historie rezervace.",
  };
}
