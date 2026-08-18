import { AdminRole, BookingActorType, BookingPaymentMethod, Prisma } from "@/generated/prisma/client";
import { z } from "zod";

import { type AdminArea } from "@/config/navigation";

type BookingPaymentDbClient = Pick<
  Prisma.TransactionClient,
  "adminUser" | "booking" | "bookingPayment" | "bookingStatusHistory"
>;

export const directBookingPaymentFieldsSchema = z.object({
  amountCzk: z.coerce
    .number({ error: "Částku zadejte jako celé číslo v Kč." })
    .int("Částka musí být celé číslo v Kč.")
    .min(1, "Částka musí být vyšší než 0."),
  method: z.nativeEnum(BookingPaymentMethod, {
    error: "Vyberte platnou metodu platby.",
  }),
  paidAt: z.coerce.date({ error: "Zadejte platné datum platby." }),
  note: z.string().trim().max(500, "Poznámka je příliš dlouhá.").optional().nullable(),
});

const directBookingPaymentSchema = directBookingPaymentFieldsSchema.extend({
  bookingId: z.string().trim().min(1).max(64),
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

export type UpdateDirectBookingPaymentInput = {
  bookingId: unknown;
  paymentId: unknown;
  amountCzk: unknown;
  method: unknown;
  paidAt: unknown;
  note?: unknown;
  expectedUpdatedAt: unknown;
  actor: CreateDirectBookingPaymentInput["actor"];
};

export type UpdateDirectBookingPaymentResult =
  | { status: "updated"; payment: { id: string; bookingId: string } }
  | { status: "not-found" | "voided" | "conflict" | "unauthorized" }
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

/** Updates an active direct payment and stores an immutable before/after audit event. */
export async function updateDirectBookingPayment(
  db: BookingPaymentDbClient,
  input: UpdateDirectBookingPaymentInput,
): Promise<UpdateDirectBookingPaymentResult> {
  const parsed = directBookingPaymentFieldsSchema.safeParse(input);
  const expectedUpdatedAt = z.coerce.date().safeParse(input.expectedUpdatedAt);
  const identifiers = z.object({
    bookingId: z.string().trim().min(1).max(64),
    paymentId: z.string().trim().min(1).max(64),
  }).safeParse(input);

  if (!parsed.success || !expectedUpdatedAt.success || !identifiers.success) {
    const fieldErrors = parsed.success ? {} : parsed.error.flatten().fieldErrors;
    return { status: "invalid", fieldErrors: {
      amountCzk: fieldErrors.amountCzk?.[0], method: fieldErrors.method?.[0],
      paidAt: fieldErrors.paidAt?.[0], note: fieldErrors.note?.[0],
    } };
  }
  if (!isRoleAllowedInArea(input.actor.role, input.actor.area)) return { status: "unauthorized" };

  const actor = await db.adminUser.findFirst({
    where: { email: { equals: input.actor.email.trim(), mode: "insensitive" }, isActive: true, role: input.actor.role },
    select: { id: true },
  });
  if (!actor) return { status: "unauthorized" };

  const payment = await db.bookingPayment.findUnique({
    where: { id: identifiers.data.paymentId },
    select: { id: true, bookingId: true, status: true, updatedAt: true, amountCzk: true, method: true, paidAt: true, note: true, booking: { select: { status: true } } },
  });
  if (!payment || payment.bookingId !== identifiers.data.bookingId) return { status: "not-found" };
  if (payment.status !== "ACTIVE") return { status: "voided" };

  const update = await db.bookingPayment.updateMany({
    where: { id: payment.id, bookingId: payment.bookingId, status: "ACTIVE", updatedAt: expectedUpdatedAt.data },
    data: { amountCzk: parsed.data.amountCzk, method: parsed.data.method, paidAt: parsed.data.paidAt, note: parsed.data.note || null },
  });
  if (update.count !== 1) return { status: "conflict" };

  await db.bookingStatusHistory.create({ data: {
    bookingId: payment.bookingId, status: payment.booking.status, actorType: BookingActorType.USER, actorUserId: actor.id,
    reason: "Platba upravena",
    metadata: {
      source: "admin-booking-payment-update-v1", bookingId: payment.bookingId, paymentId: payment.id,
      before: { amountCzk: payment.amountCzk, method: payment.method, paidAt: payment.paidAt.toISOString(), note: payment.note },
      after: { amountCzk: parsed.data.amountCzk, method: parsed.data.method, paidAt: parsed.data.paidAt.toISOString(), note: parsed.data.note || null },
      changedByUserId: actor.id, changedAt: new Date().toISOString(),
    },
  } });
  return { status: "updated", payment: { id: payment.id, bookingId: payment.bookingId } };
}

/** Soft duplicate hint only; callers must never use it as a payment constraint. */
export async function findSimilarActiveBookingPayment(
  db: Pick<Prisma.TransactionClient, "bookingPayment">,
  input: { bookingId: string; amountCzk: number; method: BookingPaymentMethod; paidAt: Date },
) {
  return db.bookingPayment.findFirst({
    where: {
      bookingId: input.bookingId,
      status: "ACTIVE",
      method: input.method,
      amountCzk: { gte: Math.max(1, Math.floor(input.amountCzk * 0.95)), lte: Math.ceil(input.amountCzk * 1.05) },
      paidAt: { gte: new Date(input.paidAt.getTime() - 5 * 60_000), lte: new Date(input.paidAt.getTime() + 5 * 60_000) },
    },
    orderBy: { paidAt: "desc" },
    select: { id: true, amountCzk: true, paidAt: true },
  });
}
