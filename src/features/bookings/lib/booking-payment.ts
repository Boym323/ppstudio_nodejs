import { AdminRole, BookingActorType, BookingPaymentMethod, Prisma } from "@prisma/client";
import { z } from "zod";

import { type AdminArea } from "@/config/navigation";

type BookingPaymentDbClient = Pick<
  Prisma.TransactionClient,
  "adminUser" | "booking" | "bookingPayment" | "bookingStatusHistory"
>;

const directBookingPaymentSchema = z.object({
  bookingId: z.string().trim().min(1).max(64),
  amountCzk: z.coerce
    .number({ error: "Částku zadejte jako celé číslo v Kč." })
    .int("Částka musí být celé číslo v Kč.")
    .min(1, "Částka musí být vyšší než 0."),
  method: z.nativeEnum(BookingPaymentMethod, {
    error: "Vyberte platnou metodu platby.",
  }),
  paidAt: z.coerce.date({ error: "Zadejte platné datum platby." }),
  note: z.string().trim().max(500, "Poznámka je příliš dlouhá.").optional().nullable(),
  idempotencyKey: z.string().uuid("Neplatný identifikátor požadavku."),
});

export type CreateDirectBookingPaymentInput = {
  bookingId: unknown;
  amountCzk: unknown;
  method: unknown;
  paidAt: unknown;
  note?: unknown;
  idempotencyKey: unknown;
  actor: {
    area: AdminArea;
    email: string;
    role: AdminRole;
  };
  audit: {
    reason: string;
    source: "admin-booking-payment-create-v1" | "admin-booking-complete-flow-v1";
  };
};

export type CreateDirectBookingPaymentResult =
  | { status: "created" | "existing"; payment: { id: string; bookingId: string } }
  | { status: "not-found" }
  | { status: "unauthorized" }
  | { status: "idempotency-conflict" }
  | { status: "invalid"; fieldErrors: Record<string, string | undefined> };

function isRoleAllowedInArea(role: AdminRole, area: AdminArea) {
  return area === "owner" ? role === AdminRole.OWNER : role === AdminRole.OWNER || role === AdminRole.SALON;
}

/**
 * Creates one direct booking payment and its audit record. The caller may pass
 * either PrismaClient or an interactive transaction client.
 */
export async function createDirectBookingPayment(
  db: BookingPaymentDbClient,
  input: CreateDirectBookingPaymentInput,
): Promise<CreateDirectBookingPaymentResult> {
  const parsed = directBookingPaymentSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      status: "invalid",
      fieldErrors: {
        amountCzk: fieldErrors.amountCzk?.[0],
        method: fieldErrors.method?.[0],
        paidAt: fieldErrors.paidAt?.[0],
        note: fieldErrors.note?.[0],
        idempotencyKey: fieldErrors.idempotencyKey?.[0],
      },
    };
  }

  if (!isRoleAllowedInArea(input.actor.role, input.actor.area)) {
    return { status: "unauthorized" };
  }

  const actor = await db.adminUser.findFirst({
    where: {
      email: { equals: input.actor.email.trim(), mode: "insensitive" },
      isActive: true,
      role: input.actor.role,
    },
    select: { id: true },
  });

  if (!actor) {
    return { status: "unauthorized" };
  }

  const booking = await db.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: { id: true, status: true },
  });

  if (!booking) {
    return { status: "not-found" };
  }

  const existingPayment = await db.bookingPayment.findUnique({
    where: { idempotencyKey: parsed.data.idempotencyKey },
    select: { id: true, bookingId: true },
  });

  if (existingPayment) {
    if (existingPayment.bookingId !== booking.id) {
      return { status: "idempotency-conflict" };
    }
    return { status: "existing", payment: existingPayment };
  }

  const createResult = await db.bookingPayment.createMany({
    data: {
      bookingId: booking.id,
      amountCzk: parsed.data.amountCzk,
      method: parsed.data.method,
      paidAt: parsed.data.paidAt,
      note: parsed.data.note || null,
      createdByUserId: actor.id,
      idempotencyKey: parsed.data.idempotencyKey,
    },
    skipDuplicates: true,
  });
  const payment = await db.bookingPayment.findUniqueOrThrow({
    where: { idempotencyKey: parsed.data.idempotencyKey },
    select: { id: true, bookingId: true },
  });

  if (createResult.count === 0) {
    if (payment.bookingId !== booking.id) {
      return { status: "idempotency-conflict" };
    }
    return { status: "existing", payment };
  }

  await db.bookingStatusHistory.create({
    data: {
      bookingId: booking.id,
      status: booking.status,
      actorType: BookingActorType.USER,
      actorUserId: actor.id,
      reason: input.audit.reason,
      metadata: {
        source: input.audit.source,
        bookingId: booking.id,
        paymentId: payment.id,
        amount: parsed.data.amountCzk,
        method: parsed.data.method,
        paidAt: parsed.data.paidAt.toISOString(),
        createdByUserId: actor.id,
        idempotencyKey: parsed.data.idempotencyKey,
      },
    },
  });

  return { status: "created", payment };
}
