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

export async function voidBookingPaymentWithAudit(input: {
  bookingId: string;
  paymentId: string;
  voidedByUserId: string | null;
  voidReason: string;
  voidedAt?: Date;
}) {
  const voidedAt = input.voidedAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    const payment = await tx.bookingPayment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        bookingId: true,
        amountCzk: true,
        method: true,
        paidAt: true,
        note: true,
        createdByUserId: true,
        status: true,
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

    if (payment.status === "VOIDED") {
      return { status: "already-voided" as const };
    }

    const voidUpdate = await tx.bookingPayment.updateMany({
      where: { id: payment.id, status: "ACTIVE" },
      data: {
        status: "VOIDED",
        voidedAt,
        voidedByUserId: input.voidedByUserId,
        voidReason: input.voidReason,
      },
    });
    if (voidUpdate.count !== 1) {
      return { status: "already-voided" as const };
    }

    await tx.bookingStatusHistory.create({
      data: {
        bookingId: payment.bookingId,
        status: payment.booking.status,
        actorType: BookingActorType.USER,
        actorUserId: input.voidedByUserId,
        reason: "Platba stornována",
        metadata: {
          source: "admin-booking-payment-void-v1",
          bookingId: payment.bookingId,
          paymentId: payment.id,
          originalAmountCzk: payment.amountCzk,
          originalMethod: payment.method,
          originalPaidAt: payment.paidAt.toISOString(),
          originalNote: payment.note,
          originalCreatedByUserId: payment.createdByUserId,
          voidedByUserId: input.voidedByUserId,
          voidedAt: voidedAt.toISOString(),
          voidReason: input.voidReason,
        },
      },
    });

    return { status: "voided" as const, bookingId: payment.bookingId };
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
    voidReason: readFormString(formData, "voidReason"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      formError: "Platbu se nepodařilo určit.",
    };
  }

  const session = await requireRole([AdminRole.OWNER]);
  const voidedByUserId = await resolveCurrentAdminUserId(session.email);
  const result = await voidBookingPaymentWithAudit({
    bookingId: parsed.data.bookingId,
    paymentId: parsed.data.paymentId,
    voidedByUserId,
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
