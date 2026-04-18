import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingActorType,
  BookingActionTokenType,
  BookingSource,
  BookingStatus,
  EmailLogStatus,
  EmailLogType,
  Prisma,
} from "@prisma/client";

import { env } from "@/config/env";
import {
  buildBookingActionToken,
  buildBookingCancellationUrl,
} from "@/features/booking/lib/booking-action-tokens";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
import { prisma } from "@/lib/prisma";

const ACTIVE_BOOKING_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;
const CANCELLATION_TOKEN_TTL_DAYS = 30;
const MAX_BOOKING_TRANSACTION_RETRIES = 3;

export const publicBookingErrorCodes = {
  serviceUnavailable: "SERVICE_UNAVAILABLE",
  slotUnavailable: "SLOT_UNAVAILABLE",
  slotNotAllowed: "SLOT_NOT_ALLOWED",
  slotTooShort: "SLOT_TOO_SHORT",
  slotAlreadyBookedByClient: "SLOT_ALREADY_BOOKED_BY_CLIENT",
  bookingConflict: "BOOKING_CONFLICT",
  temporaryFailure: "TEMPORARY_FAILURE",
} as const;

export type PublicBookingErrorCode =
  (typeof publicBookingErrorCodes)[keyof typeof publicBookingErrorCodes];

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
  emailDeliveryStatus: "queued" | "logged" | "skipped";
};

type LockedSlotRow = {
  id: string;
};

export class PublicBookingError extends Error {
  code: PublicBookingErrorCode;
  suggestedStep: 1 | 2 | 3 | 4;

  constructor(
    code: PublicBookingErrorCode,
    message: string,
    suggestedStep: 1 | 2 | 3 | 4 = 4,
  ) {
    super(message);
    this.name = "PublicBookingError";
    this.code = code;
    this.suggestedStep = suggestedStep;
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

  const trimmed = normalizeWhitespace(phone);
  const hasInternationalPrefix = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (digitsOnly.length === 0) {
    return undefined;
  }

  const normalized = `${hasInternationalPrefix ? "+" : ""}${digitsOnly}`;
  return normalized.length > 0 ? normalized : undefined;
}

export function isValidNormalizedClientPhone(phone?: string) {
  if (!phone) {
    return true;
  }

  return /^\+?\d{8,15}$/.test(phone);
}

function doesSlotSupportServiceDuration(startsAt: Date, endsAt: Date, serviceDurationMinutes: number) {
  return endsAt.getTime() - startsAt.getTime() >= serviceDurationMinutes * 60 * 1000;
}

function isRetryablePrismaError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function getUniqueConstraintTargets(error: Prisma.PrismaClientKnownRequestError) {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.map((item) => String(item));
  }

  if (typeof target === "string") {
    return [target];
  }

  return [];
}

function mapKnownPrismaError(error: Prisma.PrismaClientKnownRequestError) {
  if (error.code !== "P2002") {
    return null;
  }

  const targets = getUniqueConstraintTargets(error);

  if (
    targets.includes("Booking_slotId_clientId_key") ||
    (targets.includes("slotId") && targets.includes("clientId"))
  ) {
    return new PublicBookingError(
      publicBookingErrorCodes.slotAlreadyBookedByClient,
      "Tento termín už máte rezervovaný pod stejným e-mailem.",
      2,
    );
  }

  if (
    targets.includes("Client_email_key") ||
    targets.includes("email")
  ) {
    return new PublicBookingError(
      publicBookingErrorCodes.bookingConflict,
      "Rezervaci se nepodařilo bezpečně potvrdit kvůli souběžné změně. Zkuste to prosím znovu.",
      3,
    );
  }

  if (
    targets.includes("BookingActionToken_tokenHash_key") ||
    targets.includes("tokenHash")
  ) {
    return new PublicBookingError(
      publicBookingErrorCodes.temporaryFailure,
      "Rezervaci se teď nepodařilo dokončit kvůli internímu konfliktu. Zkuste to prosím znovu.",
      4,
    );
  }

  return new PublicBookingError(
    publicBookingErrorCodes.bookingConflict,
    "Vybraný termín už není k dispozici. Obnovte prosím výběr termínu.",
    2,
  );
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

  if (!isValidNormalizedClientPhone(normalizedPhone)) {
    throw new PublicBookingError(
      publicBookingErrorCodes.bookingConflict,
      "Zadejte telefon ve formátu s 8 až 15 číslicemi, případně s úvodním +.",
      3,
    );
  }

  for (let attempt = 1; attempt <= MAX_BOOKING_TRANSACTION_RETRIES; attempt += 1) {
    try {
      const transactionResult = await prisma.$transaction(
        async (tx) => {
          const now = new Date();
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
            throw new PublicBookingError(
              publicBookingErrorCodes.serviceUnavailable,
              "Vybraná služba už není dostupná. Vyberte prosím jinou.",
              1,
            );
          }

          const lockedSlotRows = await tx.$queryRaw<LockedSlotRow[]>(Prisma.sql`
            SELECT "id"
            FROM "AvailabilitySlot"
            WHERE "id" = ${input.slotId}
            FOR UPDATE
          `);

          if (lockedSlotRows.length === 0) {
            throw new PublicBookingError(
              publicBookingErrorCodes.slotUnavailable,
              "Vybraný termín už není dostupný.",
              2,
            );
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
            throw new PublicBookingError(
              publicBookingErrorCodes.slotUnavailable,
              "Vybraný termín už není dostupný.",
              2,
            );
          }

          if (
            slot.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.SELECTED &&
            !slot.allowedServices.some((allowedService) => allowedService.serviceId === service.id)
          ) {
            throw new PublicBookingError(
              publicBookingErrorCodes.slotNotAllowed,
              "Vybraný termín není pro tuto službu dostupný.",
              2,
            );
          }

          if (!doesSlotSupportServiceDuration(slot.startsAt, slot.endsAt, service.durationMinutes)) {
            throw new PublicBookingError(
              publicBookingErrorCodes.slotTooShort,
              "Vybraný termín už neodpovídá délce služby. Vyberte prosím jiný.",
              2,
            );
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
            throw new PublicBookingError(
              publicBookingErrorCodes.slotUnavailable,
              "Vybraný termín byl mezitím obsazený. Vyberte prosím jiný.",
              2,
            );
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

          const existingClientBooking = await tx.booking.findFirst({
            where: {
              clientId: client.id,
              slotId: slot.id,
              status: {
                in: [...ACTIVE_BOOKING_STATUSES],
              },
            },
            select: {
              id: true,
            },
          });

          if (existingClientBooking) {
            throw new PublicBookingError(
              publicBookingErrorCodes.slotAlreadyBookedByClient,
              "Tento termín už máte rezervovaný pod stejným e-mailem.",
              2,
            );
          }

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

          const cancellationToken = buildBookingActionToken();
          const cancellationUrl = buildBookingCancellationUrl(cancellationToken.rawToken);
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
              status: env.EMAIL_DELIVERY_MODE === "background" ? undefined : EmailLogStatus.SENT,
              attemptCount: env.EMAIL_DELIVERY_MODE === "background" ? undefined : 1,
              nextAttemptAt: env.EMAIL_DELIVERY_MODE === "background" ? now : undefined,
              processingStartedAt: null,
              processingToken: null,
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
              provider: env.EMAIL_DELIVERY_MODE === "background" ? undefined : "log",
              sentAt: env.EMAIL_DELIVERY_MODE === "background" ? undefined : now,
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
      const bookingResult: CreatePublicBookingResult = {
        bookingId: transactionResult.bookingId,
        referenceCode: transactionResult.referenceCode,
        serviceName: transactionResult.serviceName,
        scheduledAtLabel: transactionResult.scheduledAtLabel,
        clientName: transactionResult.clientName,
        clientEmail: transactionResult.clientEmail,
        emailDeliveryStatus:
          env.EMAIL_DELIVERY_MODE === "background" ? "queued" : "logged",
      };

      return {
        ...bookingResult,
      };
    } catch (error) {
      if (error instanceof PublicBookingError) {
        throw error;
      }

      if (isRetryablePrismaError(error) && attempt < MAX_BOOKING_TRANSACTION_RETRIES) {
        continue;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const mappedError = mapKnownPrismaError(error);

        if (mappedError) {
          throw mappedError;
        }
      }

      throw error;
    }
  }

  throw new PublicBookingError(
    publicBookingErrorCodes.temporaryFailure,
    "Rezervaci se teď nepodařilo dokončit kvůli souběžné změně. Zkuste to prosím znovu za chvíli.",
    4,
  );
}
