"use server";

import { AdminRole, BookingPaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  type CreateBookingPaymentActionState,
  type DeleteBookingPaymentActionState,
} from "@/features/bookings/actions/booking-payment-action-state";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const createBookingPaymentSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  amountCzk: z.coerce
    .number({ error: "Částku zadejte jako celé číslo v Kč." })
    .int("Částka musí být celé číslo v Kč.")
    .min(1, "Částka musí být vyšší než 0."),
  method: z.nativeEnum(BookingPaymentMethod, {
    error: "Vyberte platnou metodu platby.",
  }),
  paidAt: z.string().trim().min(1, "Zadejte datum platby.").refine(
    (value) => Number.isFinite(new Date(value).getTime()),
    "Zadejte platné datum platby.",
  ),
  note: z.string().trim().max(500, "Poznámka je příliš dlouhá.").optional().or(z.literal("")),
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
  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: { id: true },
  });

  if (!booking) {
    return {
      status: "error",
      formError: "Rezervaci se nepodařilo najít.",
    };
  }

  const createdByUserId = await resolveCurrentAdminUserId(session.email);

  await prisma.bookingPayment.create({
    data: {
      bookingId: booking.id,
      amountCzk: parsed.data.amountCzk,
      method: parsed.data.method,
      paidAt: new Date(parsed.data.paidAt),
      note: parsed.data.note || null,
      createdByUserId,
    },
  });

  revalidateBookingAdminPaths(booking.id);

  return {
    status: "success",
    successMessage: "Platba je zapsaná a souhrn úhrady je aktuální.",
  };
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

  await requireRole([AdminRole.OWNER]);

  const payment = await prisma.bookingPayment.findUnique({
    where: { id: parsed.data.paymentId },
    select: {
      id: true,
      bookingId: true,
    },
  });

  if (!payment || payment.bookingId !== parsed.data.bookingId) {
    return {
      status: "error",
      formError: "Platbu se nepodařilo najít u této rezervace.",
    };
  }

  await prisma.bookingPayment.delete({
    where: { id: payment.id },
  });

  revalidateBookingAdminPaths(payment.bookingId);

  return {
    status: "success",
    successMessage: "Platba byla smazaná.",
  };
}
