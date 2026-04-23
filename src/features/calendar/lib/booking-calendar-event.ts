import { BookingActionTokenType, BookingStatus } from "@prisma/client";

import { env } from "@/config/env";
import { hashBookingActionToken } from "@/features/booking/lib/booking-action-tokens";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
import { prisma } from "@/lib/prisma";
import { getSalonAddressLine, getSiteSettings } from "@/lib/site-settings";

import { buildCalendarIcs } from "./calendar-ics";

type BookingCalendarTokenRecord = {
  id: string;
  bookingId: string;
  type: BookingActionTokenType;
  expiresAt: Date;
  revokedAt: Date | null;
  booking: {
    id: string;
    status: BookingStatus;
    clientNameSnapshot: string;
    clientEmailSnapshot: string;
    clientPhoneSnapshot: string | null;
    serviceNameSnapshot: string;
    clientNote: string | null;
    scheduledStartsAt: Date;
    scheduledEndsAt: Date;
    confirmedAt: Date | null;
    cancelledAt: Date | null;
    updatedAt: Date;
  } | null;
};

export type BookingCalendarAccessState =
  | {
      status: "available";
      booking: NonNullable<BookingCalendarTokenRecord["booking"]>;
      tokenId: string;
    }
  | {
      status: "unavailable";
      reason: "invalid" | "expired" | "not-found" | "not-confirmed" | "cancelled";
    };

function getCalendarEventUidHost() {
  try {
    return new URL(env.NEXT_PUBLIC_APP_URL).host || "ppstudio.local";
  } catch {
    return "ppstudio.local";
  }
}

function buildBookingCalendarDescription(input: {
  serviceName: string;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
  salonName: string;
  phone: string;
  email: string;
  clientNote?: string | null;
}) {
  const lines = [
    `Služba: ${input.serviceName}`,
    `Termín: ${formatBookingDateLabel(input.scheduledStartsAt, input.scheduledEndsAt)}`,
    `Studio: ${input.salonName}`,
    `Telefon: ${input.phone}`,
    `E-mail: ${input.email}`,
  ];

  if (input.clientNote) {
    lines.push(`Poznámka: ${input.clientNote}`);
  }

  return lines.join("\n");
}

async function findBookingCalendarToken(rawToken: string) {
  const tokenHash = hashBookingActionToken(rawToken);

  return prisma.bookingActionToken.findUnique({
    where: {
      tokenHash,
    },
    select: {
      id: true,
      bookingId: true,
      type: true,
      expiresAt: true,
      revokedAt: true,
      booking: {
        select: {
          id: true,
          status: true,
          clientNameSnapshot: true,
          clientEmailSnapshot: true,
          clientPhoneSnapshot: true,
          serviceNameSnapshot: true,
          clientNote: true,
          scheduledStartsAt: true,
          scheduledEndsAt: true,
          confirmedAt: true,
          cancelledAt: true,
          updatedAt: true,
        },
      },
    },
  }) as Promise<BookingCalendarTokenRecord | null>;
}

export async function resolveBookingCalendarAccess(rawToken: string): Promise<BookingCalendarAccessState> {
  const token = await findBookingCalendarToken(rawToken.trim());

  if (!token || token.type !== BookingActionTokenType.CALENDAR) {
    return {
      status: "unavailable",
      reason: "invalid",
    };
  }

  if (token.expiresAt <= new Date() || token.revokedAt) {
    return {
      status: "unavailable",
      reason: "expired",
    };
  }

  if (!token.booking) {
    return {
      status: "unavailable",
      reason: "not-found",
    };
  }

  if (token.booking.status === BookingStatus.CANCELLED || token.booking.cancelledAt) {
    return {
      status: "unavailable",
      reason: "cancelled",
    };
  }

  if (token.booking.status !== BookingStatus.CONFIRMED || !token.booking.confirmedAt) {
    return {
      status: "unavailable",
      reason: "not-confirmed",
    };
  }

  return {
    status: "available",
    booking: token.booking,
    tokenId: token.id,
  };
}

export async function buildBookingCalendarIcs(booking: {
  id: string;
  serviceNameSnapshot: string;
  clientNote: string | null;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
  confirmedAt: Date | null;
  updatedAt: Date;
}) {
  const settings = await getSiteSettings();
  const uidHost = getCalendarEventUidHost();
  const location = `${settings.salonName}, ${getSalonAddressLine(settings)}`;

  return buildCalendarIcs({
    productId: "-//PP Studio//Booking Event//CS",
    name: `${settings.salonName} • rezervace klientky`,
    description: "Jednotlivá potvrzená rezervace salonu PP Studio pro osobní kalendář klientky.",
    events: [
      {
        uid: `${booking.id}@${uidHost}`,
        summary: `${settings.salonName} – ${booking.serviceNameSnapshot}`,
        description: buildBookingCalendarDescription({
          serviceName: booking.serviceNameSnapshot,
          scheduledStartsAt: booking.scheduledStartsAt,
          scheduledEndsAt: booking.scheduledEndsAt,
          salonName: settings.salonName,
          phone: settings.phone,
          email: settings.contactEmail,
          clientNote: booking.clientNote,
        }),
        location,
        status: "CONFIRMED",
        startsAt: booking.scheduledStartsAt,
        endsAt: booking.scheduledEndsAt,
        dtStamp: booking.confirmedAt ?? booking.updatedAt,
        lastModified: booking.updatedAt,
        sequence: Math.max(0, Math.floor(booking.updatedAt.getTime() / 1000)),
      },
    ],
  });
}

export async function buildBookingCalendarIcsFromPayload(input: {
  bookingId: string;
  serviceName: string;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
}) {
  const settings = await getSiteSettings().catch(() => ({
    salonName: env.NEXT_PUBLIC_APP_NAME,
    addressLine: "Masarykova 12",
    city: "Brno",
    postalCode: "602 00",
    phone: "+420 777 000 000",
    contactEmail: "hello@ppstudio.cz",
  }));
  const uidHost = getCalendarEventUidHost();
  const location = `${settings.salonName}, ${getSalonAddressLine(settings)}`;

  return buildCalendarIcs({
    productId: "-//PP Studio//Booking Event//CS",
    name: `${settings.salonName} • rezervace klientky`,
    description: "Jednotlivá potvrzená rezervace salonu PP Studio pro osobní kalendář klientky.",
    events: [
      {
        uid: `${input.bookingId}@${uidHost}`,
        summary: `${settings.salonName} – ${input.serviceName}`,
        description: buildBookingCalendarDescription({
          serviceName: input.serviceName,
          scheduledStartsAt: input.scheduledStartsAt,
          scheduledEndsAt: input.scheduledEndsAt,
          salonName: settings.salonName,
          phone: settings.phone,
          email: settings.contactEmail,
        }),
        location,
        status: "CONFIRMED",
        startsAt: input.scheduledStartsAt,
        endsAt: input.scheduledEndsAt,
        dtStamp: new Date(),
        lastModified: new Date(),
        sequence: Math.max(0, Math.floor(Date.now() / 1000)),
      },
    ],
  });
}
