"use server";

import { AdminRole, BookingPaymentMethod } from "@/generated/prisma/browser";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  type CreateBookingPaymentActionState,
  type DeleteBookingPaymentActionState,
  type UpdateBookingPaymentActionState,
} from "@/features/booking/payments/actions/booking-payment-action-state";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createDirectBookingPayment, findSimilarActiveBookingPayment, updateDirectBookingPayment } from "@/features/booking/payments/lib/booking-payment";
import { voidBookingPaymentWithAudit } from "@/features/booking/payments/lib/booking-payment-mutations";
import { BOOKING_PAYMENT_METHOD_LABELS } from "@/features/booking/payments/lib/booking-payment-summary";

const createBookingPaymentSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  amountCzk: z.unknown(),
  method: z.unknown(),
  paidAt: z.unknown(),
  note: z.unknown(),
  idempotencyKey: z.string().uuid("Neplatný identifikátor požadavku."),
  confirmSimilarPayment: z.enum(["true", ""]).optional(),
});

const updateBookingPaymentSchema = z.object({
  area: z.enum(["owner", "salon"]), bookingId: z.string().trim().min(1).max(64),
  paymentId: z.string().trim().min(1).max(64), expectedUpdatedAt: z.string().trim().min(1).max(64),
  amountCzk: z.unknown(), method: z.unknown(), paidAt: z.unknown(), note: z.unknown(),
});

const deleteBookingPaymentSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  paymentId: z.string().trim().min(1).max(64),
  voidReason: z.string().trim().min(1, "Uveďte důvod storna.").max(500, "Důvod storna je příliš dlouhý."),
});

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

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

export async function createBookingPaymentAction(
  _previousState: CreateBookingPaymentActionState,
  formData: FormData,
): Promise<CreateBookingPaymentActionState> {
  const parsed = createBookingPaymentSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    amountCzk: readFormString(formData, "amountCzk"),
    method: readFormString(formData, "method"),
    paidAt: readFormString(formData, "paidAt"),
    note: readFormString(formData, "note"),
    idempotencyKey: readFormString(formData, "idempotencyKey"),
    confirmSimilarPayment: readFormString(formData, "confirmSimilarPayment"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Platbu je potřeba doplnit nebo opravit.",
      fieldErrors: {
        amountCzk: fieldErrors.amountCzk?.[0],
        method: fieldErrors.method?.[0],
        paidAt: fieldErrors.paidAt?.[0],
        note: fieldErrors.note?.[0],
      },
    };
  }

  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  if (parsed.data.confirmSimilarPayment !== "true") {
    const amountCzk = Number(parsed.data.amountCzk);
    const paidAt = new Date(String(parsed.data.paidAt));
    if (Number.isFinite(amountCzk) && !Number.isNaN(paidAt.getTime())) {
      const method = z.nativeEnum(BookingPaymentMethod).safeParse(parsed.data.method);
      const near = method.success ? await findSimilarActiveBookingPayment(prisma, { bookingId: parsed.data.bookingId, amountCzk, method: method.data, paidAt }) : null;
      if (near) return { status: "error", formError: "Byla nalezena podobná platba. Potvrďte, že chcete pokračovat.", similarPayment: {
        id: near.id, amountCzk: near.amountCzk, methodLabel: BOOKING_PAYMENT_METHOD_LABELS[parsed.data.method as keyof typeof BOOKING_PAYMENT_METHOD_LABELS],
        minutesAgo: Math.max(0, Math.round(Math.abs(paidAt.getTime() - near.paidAt.getTime()) / 60_000)),
      } };
    }
  }
  const result = await prisma.$transaction((tx) => createDirectBookingPayment(tx, {
    bookingId: parsed.data.bookingId,
    amountCzk: parsed.data.amountCzk,
    method: parsed.data.method,
    paidAt: parsed.data.paidAt,
    note: parsed.data.note,
    idempotencyKey: parsed.data.idempotencyKey,
    actor: { area: parsed.data.area, email: session.email, role: session.role },
    audit: { reason: "Platba zapsána", source: "admin-booking-payment-create-v1" },
  }));

  if (result.status === "invalid") {
    return { status: "error", formError: "Platbu je potřeba doplnit nebo opravit.", fieldErrors: result.fieldErrors };
  }
  if (result.status === "not-found") {
    return { status: "error", formError: "Rezervaci se nepodařilo najít." };
  }
  if (result.status === "unauthorized") {
    return { status: "error", formError: "Pro zápis platby nemáte oprávnění." };
  }
  if (result.status === "idempotency-conflict") {
    return { status: "error", formError: "Požadavek na platbu nelze bezpečně zpracovat. Obnovte formulář a zkuste to znovu." };
  }

  revalidateBookingAdminPaths(result.payment.bookingId);

  return {
    status: "success",
    successMessage: result.status === "existing"
      ? "Tento požadavek na platbu už byl zpracovaný."
      : "Platba je zapsaná a souhrn úhrady je aktuální.",
  };
}

export async function updateBookingPaymentAction(
  _previousState: UpdateBookingPaymentActionState,
  formData: FormData,
): Promise<UpdateBookingPaymentActionState> {
  const parsed = updateBookingPaymentSchema.safeParse({
    area: readFormString(formData, "area"), bookingId: readFormString(formData, "bookingId"),
    paymentId: readFormString(formData, "paymentId"), expectedUpdatedAt: readFormString(formData, "expectedUpdatedAt"),
    amountCzk: readFormString(formData, "amountCzk"), method: readFormString(formData, "method"),
    paidAt: readFormString(formData, "paidAt"), note: readFormString(formData, "note"),
  });
  if (!parsed.success) return { status: "error", formError: "Platbu je potřeba doplnit nebo opravit." };
  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const result = await prisma.$transaction((tx) => updateDirectBookingPayment(tx, {
    ...parsed.data, actor: { area: parsed.data.area, email: session.email, role: session.role },
  }));
  if (result.status === "invalid") return { status: "error", formError: "Platbu je potřeba doplnit nebo opravit.", fieldErrors: result.fieldErrors };
  if (result.status === "not-found") return { status: "error", formError: "Platbu se nepodařilo najít u této rezervace." };
  if (result.status === "voided") return { status: "error", formError: "Stornovanou platbu nelze upravovat." };
  if (result.status === "conflict") return { status: "error", formError: "Platbu mezitím upravil jiný uživatel. Obnovte stránku a změny zadejte znovu." };
  if (result.status === "unauthorized") return { status: "error", formError: "Pro úpravu platby nemáte oprávnění." };
  if (result.status !== "updated") return { status: "error", formError: "Platbu se nepodařilo upravit." };
  revalidateBookingAdminPaths(result.payment.bookingId);
  return { status: "success", successMessage: "Platba byla upravena a souhrn úhrady je aktuální." };
}

export async function deleteBookingPaymentAction(
  _previousState: DeleteBookingPaymentActionState,
  formData: FormData,
): Promise<DeleteBookingPaymentActionState> {
  const parsed = deleteBookingPaymentSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    paymentId: readFormString(formData, "paymentId"),
    voidReason: readFormString(formData, "voidReason"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      formError: "Platbu se nepodařilo určit.",
    };
  }

  const session = await requireRole([AdminRole.OWNER]);
  const result = await voidBookingPaymentWithAudit({
    bookingId: parsed.data.bookingId,
    paymentId: parsed.data.paymentId,
    voidedByUserId: session.sub,
    voidReason: parsed.data.voidReason,
  });

  if (result.status === "not-found") {
    return {
      status: "error",
      formError: "Platbu se nepodařilo najít u této rezervace.",
    };
  }
  if (result.status === "already-voided") {
    return { status: "error", formError: "Tato platba už byla stornována." };
  }

  revalidateBookingAdminPaths(result.bookingId);

  return {
    status: "success",
    successMessage: "Platba byla stornována a zůstává v historii.",
  };
}
