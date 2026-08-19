import "server-only";

import { BookingActorType } from "@/generated/prisma/browser";

import { prisma } from "@/lib/prisma";

export async function voidBookingPaymentWithAudit(input: {
  bookingId: string;
  paymentId: string;
  voidedByUserId: string;
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
