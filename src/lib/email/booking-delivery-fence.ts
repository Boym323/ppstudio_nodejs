import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Lease je uložený na Bookingu, nikoli držený jako PostgreSQL lock přes HTTP
 * request. Mutace bookingové komunikace ho musí respektovat, aby nemohla
 * commitnout novou generaci uprostřed autorizovaného delivery.
 */
export const CLIENT_DELIVERY_LEASE_MS = 15 * 60 * 1000;

export type BookingClientDeliveryLeaseState = {
  clientDeliveryLeaseToken: string | null;
  clientDeliveryLeaseExpiresAt: Date | null;
};

export function hasActiveClientDeliveryLease(
  booking: BookingClientDeliveryLeaseState,
  now = new Date(),
) {
  return Boolean(
    booking.clientDeliveryLeaseToken
    && booking.clientDeliveryLeaseExpiresAt
    && booking.clientDeliveryLeaseExpiresAt > now,
  );
}

export async function acquireClientDeliveryLease(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    communicationGeneration: number;
    recipientEmail: string;
    leaseToken: string;
    now: Date;
  },
) {
  const claimed = await tx.booking.updateMany({
    where: {
      id: input.bookingId,
      communicationGeneration: input.communicationGeneration,
      clientEmailSnapshot: input.recipientEmail,
      OR: [
        { clientDeliveryLeaseToken: null },
        { clientDeliveryLeaseExpiresAt: { lte: input.now } },
      ],
    },
    data: {
      clientDeliveryLeaseToken: input.leaseToken,
      clientDeliveryLeaseExpiresAt: new Date(input.now.getTime() + CLIENT_DELIVERY_LEASE_MS),
    },
  });

  return claimed.count === 1;
}

export async function releaseClientDeliveryLease(
  bookingId: string,
  leaseToken: string,
) {
  return prisma.booking.updateMany({
    where: {
      id: bookingId,
      clientDeliveryLeaseToken: leaseToken,
    },
    data: {
      clientDeliveryLeaseToken: null,
      clientDeliveryLeaseExpiresAt: null,
    },
  });
}
