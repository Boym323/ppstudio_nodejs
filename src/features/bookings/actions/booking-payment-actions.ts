"use server";

import { AdminRole, BookingActorType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  type CreateBookingPaymentActionState,
  type DeleteBookingPaymentActionState,
} from "@/features/bookings/actions/booking-payment-action-state";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createDirectBookingPayment } from "@/features/bookings/lib/booking-payment";

const createBookingPaymentSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  amountCzk: z.unknown(),
  method: z.unknown(),
  paidAt: z.unknown(),
  note: z.unknown(),
  idempotencyKey: z.string().uuid("Neplatný identifikátor požadavku."),
});

const deleteBookingPaymentSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  paymentId: z.string().trim().min(1).max(64),
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

async function resolveCurrentAdminUserId(email: string) {
  const user = await prisma.adminUser.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: { id: true },
  });

  return user?.id ?? null;
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

export async function deleteBookingPaymentWithAudit(input: {
  bookingId: string;
  paymentId: string;
  deletedByUserId: string | null;
  deletedAt?: Date;
}) {
  const deletedAt = input.deletedAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    const payment = await tx.bookingPayment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        bookingId: true,
        amountCzk: true,
        method: true,
        booking: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!payment || payment.bookingId !== input.bookingId) {
      return { status: "not-found" as const };
    }

    await tx.bookingPayment.delete({
      where: { id: payment.id },
    });

    await tx.bookingStatusHistory.create({
      data: {
        bookingId: payment.bookingId,
        status: payment.booking.status,
        actorType: BookingActorType.USER,
        actorUserId: input.deletedByUserId,
        reason: "Platba odstraněna",
        metadata: {
          source: "admin-booking-payment-delete-v1",
          bookingId: payment.bookingId,
          paymentId: payment.id,
          amount: payment.amountCzk,
          method: payment.method,
          deletedByUserId: input.deletedByUserId,
          deletedAt: deletedAt.toISOString(),
        },
      },
    });

    return { status: "deleted" as const, bookingId: payment.bookingId };
  });
}

export async function deleteBookingPaymentAction(
  _previousState: DeleteBookingPaymentActionState,
  formData: FormData,
): Promise<DeleteBookingPaymentActionState> {
  const parsed = deleteBookingPaymentSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    paymentId: readFormString(formData, "paymentId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      formError: "Platbu se nepodařilo určit.",
    };
  }

  const session = await requireRole([AdminRole.OWNER]);
  const deletedByUserId = await resolveCurrentAdminUserId(session.email);
  const result = await deleteBookingPaymentWithAudit({
    bookingId: parsed.data.bookingId,
    paymentId: parsed.data.paymentId,
    deletedByUserId,
  });

  if (result.status === "not-found") {
    return {
      status: "error",
      formError: "Platbu se nepodařilo najít u této rezervace.",
    };
  }

  revalidateBookingAdminPaths(result.bookingId);

  return {
    status: "success",
    successMessage: "Platba byla smazaná.",
  };
}
