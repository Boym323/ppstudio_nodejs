"use server";

import { AdminRole, BookingActorType, BookingPaymentMethod, BookingSource, BookingStatus, VoucherType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type AdminArea } from "@/config/navigation";
import { type CreateManualBookingActionState } from "@/features/admin/actions/create-manual-booking-action-state";
import { type CompleteBookingVisitActionState } from "@/features/admin/actions/complete-booking-visit-action-state";
import { dispatchBookingStatusNotificationNonBlocking } from "@/features/admin/actions/booking-status-notification";
import { type RedeemBookingVoucherActionState } from "@/features/admin/actions/redeem-booking-voucher-action-state";
import { type RescheduleBookingActionState } from "@/features/admin/actions/reschedule-booking-action-state";
import { type UpdateBookingNoteActionState } from "@/features/admin/actions/update-booking-note-action-state";
import { type UpdateBookingPriceActionState } from "@/features/admin/actions/update-booking-price-action-state";
import { type UpdateBookingStatusActionState } from "@/features/admin/actions/update-booking-status-action-state";
import {
  applyAdminBookingStatusChange,
  canCompleteBookingAt,
  canApplyAdminBookingTransition,
  getAdminBookingActionOptions,
  getBookingStatusLabel,
  type AdminBookingActionValue,
  updateAdminBookingInternalNote,
} from "@/features/admin/lib/admin-booking";
import {
  CLIENT_PHONE_FORMAT_MESSAGE,
  createManualBooking,
  isValidClientPhoneInput,
  normalizeClientPhone,
  PublicBookingError,
} from "@/features/booking/lib/booking-public";
import {
  bookingRescheduleErrorCodes,
  BookingRescheduleError,
  rescheduleBooking,
} from "@/features/booking/lib/booking-rescheduling";
import { resolvePragueLocalDateTime } from "@/features/booking/lib/booking-local-time";
import {
  redeemVoucherForBooking,
  VoucherRedemptionError,
  voucherRedemptionErrorCodes,
} from "@/features/vouchers/lib/voucher-redemption";
import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { getBookingPaymentSummary } from "@/features/bookings/lib/booking-payment-summary";
import { requireAdminArea, requireRole } from "@/lib/auth/session";
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

const updateBookingPriceSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  finalPriceCzk: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.coerce
      .number({ error: "Cenu zadejte jako celé číslo v Kč." })
      .int("Cena musí být celé číslo v Kč.")
      .min(0, "Cena nesmí být záporná.")
      .max(100_000, "Cena je mimo běžný rozsah.")
      .nullable(),
  ),
  priceAdjustmentReason: z.string().trim().max(500, "Důvod je příliš dlouhý.").optional().or(z.literal("")),
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
  email: z
    .string()
    .trim()
    .max(254, "E-mail je příliš dlouhý.")
    .refine((value) => value.length === 0 || z.email().safeParse(value).success, {
      message: "Zadejte platný e-mail.",
    }),
  phone: z
    .string()
    .trim()
    .max(32, "Telefon je příliš dlouhý.")
    .refine((value) => isValidClientPhoneInput(value), {
      message: CLIENT_PHONE_FORMAT_MESSAGE,
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

const redeemBookingVoucherSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  voucherCode: z.string().trim().min(1, "Zadejte kód voucheru.").max(64, "Kód voucheru je příliš dlouhý."),
  amountCzk: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce
      .number({ error: "Částku zadejte jako celé číslo v Kč." })
      .int("Částka musí být celé číslo v Kč.")
      .min(1, "Částka musí být vyšší než 0.")
      .optional(),
  ),
  note: z.string().trim().max(2000, "Poznámka je příliš dlouhá.").optional().or(z.literal("")),
});

const completeBookingVisitSchema = z
  .object({
    area: z.enum(["owner", "salon"]),
    bookingId: z.string().trim().min(1).max(64),
    completionMode: z.enum(["cash", "qr", "voucher", "combined", "no_payment", "settled"]),
    reason: z.string().trim().max(160, "Důvod je příliš dlouhý.").optional().or(z.literal("")),
    voucherCode: z.string().trim().max(64).optional().or(z.literal("")),
    voucherAmountCzk: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce
        .number({ error: "Částka voucheru musí být celé číslo v Kč." })
        .int("Částka voucheru musí být celé číslo v Kč.")
        .min(1, "Částka voucheru musí být vyšší než 0.")
        .optional(),
    ),
    directAmountCzk: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce
        .number({ error: "Částka platby musí být celé číslo v Kč." })
        .int("Částka platby musí být celé číslo v Kč.")
        .min(1, "Částka platby musí být vyšší než 0.")
        .optional(),
    ),
    directMethod: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.enum(["CASH", "BANK_TRANSFER"]).optional(),
    ),
    paymentNote: z.string().trim().max(500, "Poznámka je příliš dlouhá.").optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.completionMode === "no_payment" && !(value.reason ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Pro dokončení bez úhrady je povinný důvod.",
      });
    }

    if (
      (value.completionMode === "voucher" || value.completionMode === "combined")
      && !(value.voucherCode ?? "").trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["voucherCode"],
        message: "Zadejte kód voucheru.",
      });
    }

    if (value.completionMode === "combined" && !value.directMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["directMethod"],
        message: "Vyberte způsob přímé platby.",
      });
    }

    if (
      (value.completionMode === "cash" || value.completionMode === "qr" || value.completionMode === "combined")
      && !value.directAmountCzk
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["directAmountCzk"],
        message: "Zadejte částku přímé platby.",
      });
    }
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

async function resolveVoucherRedemptionActorUserId(email: string) {
  const dbUser = await prisma.adminUser.findFirst({
    where: {
      email: {
        equals: email.trim(),
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  return dbUser?.id ?? null;
}

function resolveActionArea(role: AdminRole, requestedArea: AdminArea): AdminArea {
  if (role === AdminRole.SALON) {
    return "salon";
  }

  return requestedArea;
}

function getVoucherRedemptionFormError(error: VoucherRedemptionError) {
  switch (error.code) {
    case voucherRedemptionErrorCodes.voucherNotFound:
      return "Voucher s tímto kódem se nepodařilo najít.";
    case voucherRedemptionErrorCodes.bookingNotFound:
      return "Rezervaci se nepodařilo najít.";
    case voucherRedemptionErrorCodes.bookingAlreadyRedeemed:
      return "Na této rezervaci už je voucher uplatněný. Další voucher už nejde přidat.";
    case voucherRedemptionErrorCodes.voucherNotRedeemable:
      return "Voucher teď nejde uplatnit. Zkontrolujte jeho stav a platnost.";
    case voucherRedemptionErrorCodes.amountRequired:
      return "U hodnotového voucheru zadejte částku k uplatnění.";
    case voucherRedemptionErrorCodes.insufficientRemainingValue:
      return "Voucher nemá tak vysoký zůstatek. Zadejte maximálně zbývající hodnotu voucheru; zbytek ceny se doplatí mimo voucher.";
    case voucherRedemptionErrorCodes.serviceMismatch:
      return "Tento voucher je vystavený na jinou službu než aktuální rezervace.";
    case voucherRedemptionErrorCodes.concurrentRedemption:
      return "Voucher se mezitím změnil. Obnovte detail rezervace a zkuste to znovu.";
    default:
      return "Voucher se nepodařilo uplatnit. Zkontrolujte kód a zkuste to znovu.";
  }
}

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

function formatCzk(value: number) {
  return czkFormatter.format(value);
}

function getVoucherRedemptionSuccessMessage(
  area: AdminArea,
  requestedAmountCzk: number | undefined,
  redeemedAmountCzk: number | null,
) {
  if (
    typeof requestedAmountCzk === "number" &&
    typeof redeemedAmountCzk === "number" &&
    redeemedAmountCzk < requestedAmountCzk
  ) {
    const remainingAmountCzk = requestedAmountCzk - redeemedAmountCzk;

    return `Voucher je uplatněný ve výši ${formatCzk(redeemedAmountCzk)}. Nepokrývá celou zadanou částku; zbývá doplatek ${formatCzk(remainingAmountCzk)} mimo voucher.`;
  }

  return area === "salon"
    ? "Voucher je uplatněný a propsal se do detailu rezervace."
    : "Voucher je uplatněný a historie rezervace je aktuální.";
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

  if (result.status === "completion-too-early") {
    return {
      status: "error",
      formError: "Rezervaci lze označit jako hotovou až po skončení naplánovaného termínu.",
    };
  }

  if (
    parsed.data.targetStatus === BookingStatus.CONFIRMED
    || parsed.data.targetStatus === BookingStatus.CANCELLED
  ) {
    dispatchBookingStatusNotificationNonBlocking({
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

export async function updateBookingPriceAction(
  _previousState: UpdateBookingPriceActionState,
  formData: FormData,
): Promise<UpdateBookingPriceActionState> {
  const parsed = updateBookingPriceSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    finalPriceCzk: readFormString(formData, "finalPriceCzk"),
    priceAdjustmentReason: readFormString(formData, "priceAdjustmentReason"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Cenu rezervace je potřeba doplnit nebo opravit.",
      fieldErrors: {
        finalPriceCzk: fieldErrors.finalPriceCzk?.[0],
        priceAdjustmentReason: fieldErrors.priceAdjustmentReason?.[0],
      },
    };
  }

  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: {
      id: true,
      clientId: true,
      servicePriceFromCzk: true,
      service: {
        select: {
          priceFromCzk: true,
        },
      },
    },
  });

  if (!booking) {
    return {
      status: "error",
      formError: "Rezervaci se nepodařilo najít.",
    };
  }

  const basePriceCzk = Math.max(0, booking.servicePriceFromCzk ?? booking.service.priceFromCzk ?? 0);
  const nextFinalPriceCzk = parsed.data.finalPriceCzk;
  const normalizedReason = parsed.data.priceAdjustmentReason?.trim() ?? "";
  const clearsAdjustment = nextFinalPriceCzk === null || nextFinalPriceCzk === basePriceCzk;

  if (!clearsAdjustment && normalizedReason.length === 0) {
    return {
      status: "error",
      formError: "Upravená cena potřebuje krátký důvod.",
      fieldErrors: {
        priceAdjustmentReason: "Doplňte důvod úpravy ceny.",
      },
    };
  }

  const actorUserId = await resolveVoucherRedemptionActorUserId(session.email);

  await prisma.booking.update({
    where: { id: booking.id },
    data: clearsAdjustment
      ? {
          finalPriceCzk: null,
          priceAdjustmentReason: null,
          priceAdjustedAt: null,
          priceAdjustedByUserId: null,
        }
      : {
          finalPriceCzk: nextFinalPriceCzk,
          priceAdjustmentReason: normalizedReason,
          priceAdjustedAt: new Date(),
          priceAdjustedByUserId: actorUserId,
        },
  });

  revalidateBookingAdminPaths(booking.id);
  revalidatePath(`/admin/klienti/${booking.clientId}`);
  revalidatePath(`/admin/provoz/klienti/${booking.clientId}`);

  return {
    status: "success",
    successMessage: clearsAdjustment
      ? "Individuální cena byla zrušená, rezervace znovu používá ceníkovou cenu."
      : "Individuální cena rezervace je uložená.",
  };
}

export async function redeemBookingVoucherAction(
  _previousState: RedeemBookingVoucherActionState,
  formData: FormData,
): Promise<RedeemBookingVoucherActionState> {
  const parsed = redeemBookingVoucherSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    voucherCode: readFormString(formData, "voucherCode"),
    amountCzk: readFormString(formData, "amountCzk"),
    note: readFormString(formData, "note"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Voucher je potřeba ještě doplnit nebo opravit.",
      fieldErrors: {
        voucherCode: fieldErrors.voucherCode?.[0],
        amountCzk: fieldErrors.amountCzk?.[0],
        note: fieldErrors.note?.[0],
      },
    };
  }

  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const area = resolveActionArea(session.role, parsed.data.area as AdminArea);
  const actorUserId = await resolveVoucherRedemptionActorUserId(session.email);

  let redeemedVoucherId: string | null = null;
  let redeemedAmountCzk: number | null = null;

  try {
    const result = await redeemVoucherForBooking({
      bookingId: parsed.data.bookingId,
      voucherCode: parsed.data.voucherCode,
      amountCzk: parsed.data.amountCzk,
      redeemedByUserId: actorUserId,
      note: parsed.data.note || undefined,
    });

    redeemedVoucherId = result.voucher.id;
    redeemedAmountCzk = result.redemption.amountCzk;
  } catch (error) {
    if (error instanceof VoucherRedemptionError) {
      return {
        status: "error",
        formError: getVoucherRedemptionFormError(error),
        fieldErrors:
          error.code === voucherRedemptionErrorCodes.amountRequired ||
          error.code === voucherRedemptionErrorCodes.insufficientRemainingValue ||
          error.code === voucherRedemptionErrorCodes.bookingAlreadyRedeemed
            ? { amountCzk: getVoucherRedemptionFormError(error) }
            : error.code === voucherRedemptionErrorCodes.voucherNotFound
              ? { voucherCode: getVoucherRedemptionFormError(error) }
              : undefined,
      };
    }

    console.error("Failed to redeem voucher for booking", error);

    return {
      status: "error",
      formError: "Voucher se teď nepodařilo uplatnit. Zkuste to prosím znovu.",
    };
  }

  revalidateBookingAdminPaths(parsed.data.bookingId);
  revalidatePath("/admin/vouchery");
  revalidatePath("/admin/provoz/vouchery");

  if (redeemedVoucherId) {
    revalidatePath(`/admin/vouchery/${redeemedVoucherId}`);
    revalidatePath(`/admin/provoz/vouchery/${redeemedVoucherId}`);
  }

  return {
    status: "success",
    successMessage: getVoucherRedemptionSuccessMessage(
      area,
      parsed.data.amountCzk,
      redeemedAmountCzk,
    ),
  };
}

export async function completeBookingVisitAction(
  _previousState: CompleteBookingVisitActionState,
  formData: FormData,
): Promise<CompleteBookingVisitActionState> {
  const parsed = completeBookingVisitSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    completionMode: readFormString(formData, "completionMode"),
    reason: readFormString(formData, "reason"),
    voucherCode: readFormString(formData, "voucherCode"),
    voucherAmountCzk: readFormString(formData, "voucherAmountCzk"),
    directAmountCzk: readFormString(formData, "directAmountCzk"),
    directMethod: readFormString(formData, "directMethod"),
    paymentNote: readFormString(formData, "paymentNote"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      status: "error",
      formError: "Dokončení návštěvy je potřeba doplnit nebo opravit.",
      fieldErrors: {
        completionMode: fieldErrors.completionMode?.[0],
        reason: fieldErrors.reason?.[0],
        voucherCode: fieldErrors.voucherCode?.[0],
        voucherAmountCzk: fieldErrors.voucherAmountCzk?.[0],
        directAmountCzk: fieldErrors.directAmountCzk?.[0],
        directMethod: fieldErrors.directMethod?.[0],
      },
    };
  }

  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const actorUserId = await resolveVoucherRedemptionActorUserId(session.email);
  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: {
      id: true,
      serviceId: true,
      status: true,
      scheduledEndsAt: true,
      finalPriceCzk: true,
      servicePriceFromCzk: true,
      voucherRedemptions: { select: { amountCzk: true } },
      payments: { select: { amountCzk: true } },
      service: { select: { priceFromCzk: true } },
    },
  });

  if (!booking) {
    return { status: "error", formError: "Rezervaci se nepodařilo najít." };
  }

  if (!canApplyAdminBookingTransition(booking.status, BookingStatus.COMPLETED)) {
    return {
      status: "error",
      formError: `Rezervaci ve stavu „${getBookingStatusLabel(booking.status)}“ teď nejde dokončit.`,
    };
  }

  if (!canCompleteBookingAt(booking.scheduledEndsAt)) {
    return {
      status: "error",
      formError: "Rezervaci lze dokončit až po skončení naplánovaného termínu.",
    };
  }

  const paymentSummary = getBookingPaymentSummary({
    totalPriceCzk: booking.finalPriceCzk ?? booking.servicePriceFromCzk ?? booking.service.priceFromCzk ?? 0,
    voucherRedemptions: booking.voucherRedemptions,
    payments: booking.payments,
  });
  const remainingCzk = paymentSummary.remainingCzk;
  const mode = parsed.data.completionMode;
  const note = parsed.data.paymentNote?.trim() || null;
  const baseReason = parsed.data.reason?.trim() || undefined;

  if (remainingCzk > 0 && mode === "settled") {
    return {
      status: "error",
      formError: "Při doplatku je potřeba vybrat způsob úhrady nebo dokončení bez úhrady.",
      fieldErrors: { completionMode: "Vyberte způsob dokončení návštěvy." },
    };
  }

  const directAmountCzk =
    mode === "cash" || mode === "qr" || mode === "combined"
      ? parsed.data.directAmountCzk ?? remainingCzk
      : 0;
  let plannedVoucherAmountCzk = 0;
  let redeemedVoucherId: string | null = null;

  if ((mode === "voucher" || mode === "combined") && remainingCzk > 0) {
    const normalizedVoucherCode = normalizeVoucherCode(parsed.data.voucherCode ?? "");
    const voucher = await prisma.voucher.findUnique({
      where: { code: normalizedVoucherCode },
      select: {
        id: true,
        type: true,
        remainingValueCzk: true,
        serviceId: true,
        servicePriceSnapshotCzk: true,
      },
    });

    if (!voucher) {
      return {
        status: "error",
        formError: getVoucherRedemptionFormError(
          new VoucherRedemptionError(voucherRedemptionErrorCodes.voucherNotFound, "Voucher was not found."),
        ),
        fieldErrors: { voucherCode: "Voucher se nepodařilo najít." },
      };
    }

    if (voucher.type === VoucherType.VALUE) {
      const requestedVoucherAmountCzk =
        parsed.data.voucherAmountCzk ?? (mode === "voucher" ? remainingCzk : undefined);

      if (!requestedVoucherAmountCzk) {
        return {
          status: "error",
          formError: "U kombinované úhrady hodnotovým voucherem zadejte částku voucheru.",
          fieldErrors: { voucherAmountCzk: "Zadejte částku voucheru." },
        };
      }

      plannedVoucherAmountCzk = Math.min(requestedVoucherAmountCzk, voucher.remainingValueCzk ?? 0);
    } else {
      if (voucher.serviceId !== booking.serviceId) {
        return {
          status: "error",
          formError: getVoucherRedemptionFormError(
            new VoucherRedemptionError(voucherRedemptionErrorCodes.serviceMismatch, "Voucher service does not match booking."),
          ),
          fieldErrors: { voucherCode: "Voucher neodpovídá službě v rezervaci." },
        };
      }

      plannedVoucherAmountCzk =
        voucher.servicePriceSnapshotCzk ?? booking.servicePriceFromCzk ?? booking.service.priceFromCzk ?? 0;
    }
  }

  if (remainingCzk > 0 && mode !== "no_payment") {
    const plannedPaidCzk = directAmountCzk + plannedVoucherAmountCzk;

    if (plannedPaidCzk < remainingCzk) {
      return {
        status: "error",
        formError:
          "Zadaná úhrada nepokrývá celý doplatek. Doplňte platbu, nebo použijte „Bez platby“ s povinným důvodem.",
        fieldErrors:
          mode === "voucher" || mode === "combined"
            ? { voucherAmountCzk: "Úhrada musí pokrýt celý doplatek." }
            : { directAmountCzk: "Úhrada musí pokrýt celý doplatek." },
      };
    }
  }

  try {
    if (mode === "voucher" || mode === "combined") {
      const redemption = await redeemVoucherForBooking({
        bookingId: booking.id,
        voucherCode: parsed.data.voucherCode ?? "",
        amountCzk:
          parsed.data.voucherAmountCzk
          ?? (mode === "voucher" && remainingCzk > 0 ? remainingCzk : undefined),
        redeemedByUserId: actorUserId,
        note: note ?? undefined,
      });
      redeemedVoucherId = redemption.voucher.id;

      await prisma.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          status: booking.status,
          actorType: BookingActorType.USER,
          actorUserId,
          reason: "Voucher uplatněn při dokončení návštěvy",
          metadata: {
            source: "admin-booking-complete-flow-v1",
            amount: redemption.redemption.amountCzk,
            voucherCode: redemption.voucher.code,
          },
        },
      });
    }

    if (mode === "cash" || mode === "qr" || mode === "combined") {
      const directMethod =
        mode === "cash"
          ? BookingPaymentMethod.CASH
          : mode === "qr"
            ? BookingPaymentMethod.BANK_TRANSFER
            : parsed.data.directMethod === "CASH"
              ? BookingPaymentMethod.CASH
              : BookingPaymentMethod.BANK_TRANSFER;

      await prisma.bookingPayment.create({
        data: {
          bookingId: booking.id,
          amountCzk: directAmountCzk,
          method: directMethod,
          paidAt: new Date(),
          note,
          createdByUserId: actorUserId,
        },
      });

      await prisma.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          status: booking.status,
          actorType: BookingActorType.USER,
          actorUserId,
          reason: "Platba zapsána při dokončení návštěvy",
          metadata: {
            source: "admin-booking-complete-flow-v1",
            amount: directAmountCzk,
            method: directMethod,
          },
        },
      });
    }
  } catch (error) {
    if (error instanceof VoucherRedemptionError) {
      return {
        status: "error",
        formError: getVoucherRedemptionFormError(error),
        fieldErrors:
          error.code === voucherRedemptionErrorCodes.voucherNotFound
            ? { voucherCode: getVoucherRedemptionFormError(error) }
            : error.code === voucherRedemptionErrorCodes.amountRequired
              || error.code === voucherRedemptionErrorCodes.insufficientRemainingValue
              ? { voucherAmountCzk: getVoucherRedemptionFormError(error) }
              : undefined,
      };
    }

    console.error("Failed to register completion payment flow", error);
    return {
      status: "error",
      formError: "Úhradu se nepodařilo zapsat. Zkuste to prosím znovu.",
    };
  }

  const completionReason =
    mode === "no_payment" && remainingCzk > 0
      ? `Rezervace označena jako hotová s neuhrazeným doplatkem. ${baseReason ?? ""}`.trim()
      : baseReason;

  const completeResult = await applyAdminBookingStatusChange({
    bookingId: booking.id,
    targetStatus: BookingStatus.COMPLETED,
    actorUserId,
    reason: completionReason,
  });

  if (completeResult.status === "completion-too-early") {
    return {
      status: "error",
      formError: "Rezervaci lze dokončit až po skončení naplánovaného termínu.",
    };
  }
  if (completeResult.status === "invalid-transition") {
    return {
      status: "error",
      formError: `Rezervace už mezitím přešla do stavu „${getBookingStatusLabel(completeResult.currentStatus)}“.`,
    };
  }
  if (completeResult.status === "not-found") {
    return {
      status: "error",
      formError: "Rezervaci se nepodařilo najít.",
    };
	  }

	  revalidateBookingAdminPaths(booking.id);
	  if (redeemedVoucherId) {
	    revalidatePath("/admin/vouchery");
	    revalidatePath("/admin/provoz/vouchery");
	    revalidatePath(`/admin/vouchery/${redeemedVoucherId}`);
	    revalidatePath(`/admin/provoz/vouchery/${redeemedVoucherId}`);
	  }

	  return {
    status: "success",
    successMessage:
      mode === "no_payment"
        ? "Návštěva je dokončená bez úhrady a důvod je uložený v historii."
        : "Úhrada je zapsaná a návštěva dokončená.",
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
      phone: normalizeClientPhone(parsed.data.phone || undefined),
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
          ? result.emailDeliveryStatus === "skipped"
            ? "Rezervace je vytvořená, ale potvrzovací e-mail jsme přeskočili, protože u klientky chybí e-mail."
            : "Rezervace je vytvořená a navazující potvrzení se propsalo do emailového flow."
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
