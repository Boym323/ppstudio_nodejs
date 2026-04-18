import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingActorType,
  BookingActionTokenType,
  BookingSource,
  BookingStatus,
  EmailLogType,
  Prisma,
} from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

const ACTIVE_BOOKING_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;
const CANCELLATION_TOKEN_TTL_DAYS = 30;

export type PublicBookingCatalog = {
  services: Array<{
    id: string;
    categoryName: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    durationMinutes: number;
    priceFromCzk: number | null;
  }>;
  slots: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    publicNote: string | null;
    remainingCapacity: number;
    serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
    allowedServiceIds: string[];
  }>;
};

export type CreatePublicBookingInput = {
  serviceId: string;
  slotId: string;
  fullName: string;
  email: string;
  phone?: string;
  clientNote?: string;
};

export type CreatePublicBookingResult = {
  bookingId: string;
  referenceCode: string;
  serviceName: string;
  scheduledAtLabel: string;
  clientName: string;
  clientEmail: string;
};

type LockedSlotRow = {
  id: string;
};

export class PublicBookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicBookingError";
  }
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeClientEmail(email: string) {
  return normalizeWhitespace(email).toLowerCase();
}

export function normalizeClientPhone(phone?: string) {
  if (!phone) {
    return undefined;
  }

  const normalized = phone.replace(/[^\d+]/g, "");
  return normalized.length > 0 ? normalized : undefined;
}

function buildCancellationToken() {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  return { rawToken, tokenHash };
}

function buildCancellationUrl(rawToken: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/rezervace/storno/${rawToken}`;
}

function formatBookingDateLabel(startsAt: Date, endsAt: Date) {
  const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Prague",
  });

  const timeFormatter = new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });

  return `${dateFormatter.format(startsAt)} od ${timeFormatter.format(startsAt)} do ${timeFormatter.format(endsAt)}`;
}

export async function getPublicBookingCatalog(): Promise<PublicBookingCatalog> {
  const now = new Date();

  const [services, slots] = await Promise.all([
    prisma.service.findMany({
      where: {
        isActive: true,
        category: {
          is: {
            isActive: true,
          },
        },
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        durationMinutes: true,
        priceFromCzk: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.availabilitySlot.findMany({
      where: {
        status: AvailabilitySlotStatus.PUBLISHED,
        startsAt: {
          gte: now,
        },
      },
      orderBy: [{ startsAt: "asc" }],
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        publicNote: true,
        capacity: true,
        serviceRestrictionMode: true,
        allowedServices: {
          select: {
            serviceId: true,
          },
        },
        bookings: {
          where: {
            status: {
              in: [...ACTIVE_BOOKING_STATUSES],
            },
          },
          select: {
            id: true,
          },
        },
      },
    }),
  ]);

  return {
    services: services.map((service) => ({
      id: service.id,
      categoryName: service.category.name,
      name: service.name,
      slug: service.slug,
      shortDescription: service.shortDescription,
      durationMinutes: service.durationMinutes,
      priceFromCzk: service.priceFromCzk,
    })),
    slots: slots
      .map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        publicNote: slot.publicNote,
        remainingCapacity: Math.max(slot.capacity - slot.bookings.length, 0),
        serviceRestrictionMode: slot.serviceRestrictionMode,
        allowedServiceIds: slot.allowedServices.map((allowedService) => allowedService.serviceId),
      }))
      .filter((slot) => slot.remainingCapacity > 0),
  };
}

export async function createPublicBooking(
  input: CreatePublicBookingInput,
): Promise<CreatePublicBookingResult> {
  const normalizedFullName = normalizeWhitespace(input.fullName);
  const normalizedEmail = normalizeClientEmail(input.email);
  const normalizedPhone = normalizeClientPhone(input.phone);
  const normalizedClientNote = input.clientNote ? normalizeWhitespace(input.clientNote) : undefined;
  const now = new Date();

  try {
    return await prisma.$transaction(
      async (tx) => {
        const service = await tx.service.findFirst({
          where: {
            id: input.serviceId,
            isActive: true,
            category: {
              is: {
                isActive: true,
              },
            },
          },
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            priceFromCzk: true,
          },
        });

        if (!service) {
          throw new PublicBookingError("Vybraná služba už není dostupná.");
        }

        const lockedSlotRows = await tx.$queryRaw<LockedSlotRow[]>(Prisma.sql`
          SELECT "id"
          FROM "AvailabilitySlot"
          WHERE "id" = ${input.slotId}
          FOR UPDATE
        `);

        if (lockedSlotRows.length === 0) {
          throw new PublicBookingError("Vybraný termín už není dostupný.");
        }

        const slot = await tx.availabilitySlot.findUnique({
          where: {
            id: input.slotId,
          },
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            capacity: true,
            status: true,
            serviceRestrictionMode: true,
            allowedServices: {
              select: {
                serviceId: true,
              },
            },
          },
        });

        if (!slot || slot.status !== AvailabilitySlotStatus.PUBLISHED || slot.startsAt < now) {
          throw new PublicBookingError("Vybraný termín už není dostupný.");
        }

        if (
          slot.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.SELECTED &&
          !slot.allowedServices.some((allowedService) => allowedService.serviceId === service.id)
        ) {
          throw new PublicBookingError("Vybraný termín není pro tuto službu dostupný.");
        }

        const activeBookingCount = await tx.booking.count({
          where: {
            slotId: slot.id,
            status: {
              in: [...ACTIVE_BOOKING_STATUSES],
            },
          },
        });

        if (activeBookingCount >= slot.capacity) {
          throw new PublicBookingError("Vybraný termín byl mezitím obsazený. Vyberte prosím jiný.");
        }

        const client = await tx.client.upsert({
          where: {
            email: normalizedEmail,
          },
          create: {
            fullName: normalizedFullName,
            email: normalizedEmail,
            phone: normalizedPhone,
            lastBookedAt: now,
          },
          update: {
            fullName: normalizedFullName,
            phone: normalizedPhone,
            isActive: true,
            lastBookedAt: now,
          },
          select: {
            id: true,
          },
        });

        const booking = await tx.booking.create({
          data: {
            clientId: client.id,
            slotId: slot.id,
            serviceId: service.id,
            source: BookingSource.PUBLIC_WEB,
            status: BookingStatus.CONFIRMED,
            clientNameSnapshot: normalizedFullName,
            clientEmailSnapshot: normalizedEmail,
            clientPhoneSnapshot: normalizedPhone,
            serviceNameSnapshot: service.name,
            serviceDurationMinutes: service.durationMinutes,
            servicePriceFromCzk: service.priceFromCzk,
            scheduledStartsAt: slot.startsAt,
            scheduledEndsAt: slot.endsAt,
            clientNote: normalizedClientNote,
            confirmedAt: now,
          },
          select: {
            id: true,
            scheduledStartsAt: true,
            scheduledEndsAt: true,
          },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            status: BookingStatus.CONFIRMED,
            actorType: BookingActorType.CLIENT,
            reason: "public-booking-flow-v1",
            metadata: {
              source: BookingSource.PUBLIC_WEB,
            },
          },
        });

        const cancellationToken = buildCancellationToken();
        const cancellationUrl = buildCancellationUrl(cancellationToken.rawToken);
        const expiresAt = new Date(
          now.getTime() + CANCELLATION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
        );

        const actionToken = await tx.bookingActionToken.create({
          data: {
            bookingId: booking.id,
            type: BookingActionTokenType.CANCEL,
            tokenHash: cancellationToken.tokenHash,
            expiresAt,
          },
          select: {
            id: true,
          },
        });

        await tx.emailLog.create({
          data: {
            bookingId: booking.id,
            clientId: client.id,
            actionTokenId: actionToken.id,
            type: EmailLogType.BOOKING_CONFIRMED,
            recipientEmail: normalizedEmail,
            subject: `Potvrzení rezervace: ${service.name}`,
            templateKey: "booking-confirmation-v1",
            payload: {
              bookingId: booking.id,
              serviceName: service.name,
              clientName: normalizedFullName,
              scheduledStartsAt: booking.scheduledStartsAt.toISOString(),
              scheduledEndsAt: booking.scheduledEndsAt.toISOString(),
              cancellationUrl,
            },
          },
        });

        return {
          bookingId: booking.id,
          referenceCode: booking.id.slice(-8).toUpperCase(),
          serviceName: service.name,
          scheduledAtLabel: formatBookingDateLabel(
            booking.scheduledStartsAt,
            booking.scheduledEndsAt,
          ),
          clientName: normalizedFullName,
          clientEmail: normalizedEmail,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (error instanceof PublicBookingError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new PublicBookingError("Vybraný termín už není k dispozici. Obnovte výběr termínu.");
    }

    throw error;
  }
}
