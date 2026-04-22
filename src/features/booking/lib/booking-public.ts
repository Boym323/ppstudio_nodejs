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
  buildBookingActionExpiry,
  buildBookingCancellationUrl,
  buildBookingEmailActionExpiry,
  buildBookingEmailActionUrl,
} from "@/features/booking/lib/booking-action-tokens";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
import { prisma } from "@/lib/prisma";
import {
  getBookingPolicySettings,
  getEmailBrandingSettings,
  isBookingWithinWindow,
} from "@/lib/site-settings";

const ACTIVE_BOOKING_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;
const MAX_BOOKING_TRANSACTION_RETRIES = 3;
const EDITABLE_SLOT_CAPACITY = 1;

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
    capacity: number;
    serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
    allowedServiceIds: string[];
    bookedIntervals: Array<{
      startsAt: string;
      endsAt: string;
    }>;
  }>;
};

export type CreatePublicBookingInput = {
  serviceId: string;
  slotId: string;
  startsAt: string;
  fullName: string;
  email: string;
  phone?: string;
  clientNote?: string;
};

export type CreatePublicBookingResult = {
  bookingId: string;
  referenceCode: string;
  serviceName: string;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  scheduledAtLabel: string;
  clientName: string;
  clientEmail: string;
  cancellationUrl: string;
  emailDeliveryStatus: "queued" | "logged" | "skipped";
};

export type CreateManualBookingInput = {
  serviceId: string;
  startsAt: string;
  slotId?: string;
  selectedClientId?: string;
  fullName: string;
  email: string;
  phone?: string;
  clientProfileNote?: string;
  clientNote?: string;
  internalNote?: string;
  source: BookingSource;
  status: "PENDING" | "CONFIRMED";
  actorUserId: string | null;
  sendClientEmail: boolean;
  includeCalendarAttachment: boolean;
};

export type CreateManualBookingResult = CreatePublicBookingResult & {
  status: "PENDING" | "CONFIRMED";
  manualOverride: boolean;
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
    targets.includes("Booking_exact_duplicate_active_key") ||
    targets.includes("Booking_slotId_clientId_scheduledStartsAt_scheduledEndsAt_key") ||
    (
      targets.includes("slotId")
      && targets.includes("clientId")
      && targets.includes("scheduledStartsAt")
      && targets.includes("scheduledEndsAt")
    )
  ) {
    return new PublicBookingError(
      publicBookingErrorCodes.slotAlreadyBookedByClient,
      "Tento konkrétní čas už máte rezervovaný pod stejným e-mailem.",
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

type BookingServiceRecord = {
  id: string;
  name: string;
  durationMinutes: number;
  priceFromCzk: number | null;
};

type BookingSlotRecord = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: AvailabilitySlotStatus;
  serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
  publicNote: string | null;
  internalNote: string | null;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  createdByUserId: string | null;
  allowedServices: Array<{
    serviceId: string;
  }>;
};

type ClientResolutionInput = {
  selectedClientId?: string;
  fullName: string;
  email: string;
  phone?: string;
  clientProfileNote?: string;
};

type SharedCreateBookingInput = {
  serviceId: string;
  slotId?: string;
  startsAt: string;
  client: ClientResolutionInput;
  clientNote?: string;
  internalNote?: string;
  source: BookingSource;
  status: "PENDING" | "CONFIRMED";
  isManual: boolean;
  allowManualOverride: boolean;
  actorType: BookingActorType;
  actorUserId?: string | null;
  historyReason: string;
  historyMetadata?: Prisma.InputJsonValue;
  sendClientEmail: boolean;
  includeCalendarAttachment: boolean;
  sendAdminNotification: boolean;
};

type SharedCreateBookingResult = {
  bookingId: string;
  referenceCode: string;
  serviceName: string;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  scheduledAtLabel: string;
  clientName: string;
  clientEmail: string;
  cancellationUrl: string;
  emailDeliveryStatus: "queued" | "logged" | "skipped";
  status: "PENDING" | "CONFIRMED";
  manualOverride: boolean;
};

async function loadServiceForBooking(
  tx: Prisma.TransactionClient,
  serviceId: string,
): Promise<BookingServiceRecord> {
  const service = await tx.service.findFirst({
    where: {
      id: serviceId,
      isActive: true,
      isPubliclyBookable: true,
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

  return service;
}

async function lockRequestedSlot(
  tx: Prisma.TransactionClient,
  slotId: string,
): Promise<BookingSlotRecord | null> {
  const lockedSlotRows = await tx.$queryRaw<LockedSlotRow[]>(Prisma.sql`
    SELECT "id"
    FROM "AvailabilitySlot"
    WHERE "id" = ${slotId}
    FOR UPDATE
  `);

  if (lockedSlotRows.length === 0) {
    return null;
  }

  return tx.availabilitySlot.findUnique({
    where: {
      id: slotId,
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      status: true,
      serviceRestrictionMode: true,
      publicNote: true,
      internalNote: true,
      publishedAt: true,
      cancelledAt: true,
      createdByUserId: true,
      allowedServices: {
        select: {
          serviceId: true,
        },
      },
    },
  });
}

async function resolveClientForBooking(
  tx: Prisma.TransactionClient,
  input: ClientResolutionInput,
  now: Date,
) {
  const normalizedFullName = normalizeWhitespace(input.fullName);
  const normalizedEmail = normalizeClientEmail(input.email);
  const normalizedPhone = normalizeClientPhone(input.phone);
  const normalizedClientProfileNote = input.clientProfileNote
    ? normalizeWhitespace(input.clientProfileNote)
    : undefined;

  if (!normalizedEmail) {
    throw new PublicBookingError(
      publicBookingErrorCodes.bookingConflict,
      "Pro rezervaci je potřeba vyplnit e-mail klientky.",
      3,
    );
  }

  if (input.selectedClientId) {
    const selectedClient = await tx.client.findUnique({
      where: {
        id: input.selectedClientId,
      },
      select: {
        id: true,
        internalNote: true,
      },
    });

    if (!selectedClient) {
      throw new PublicBookingError(
        publicBookingErrorCodes.bookingConflict,
        "Vybraná klientka už v systému není. Obnovte prosím výběr.",
        3,
      );
    }

    const updatedClient = await tx.client.update({
      where: {
        id: selectedClient.id,
      },
      data: {
        fullName: normalizedFullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        isActive: true,
        lastBookedAt: now,
        internalNote: selectedClient.internalNote ?? normalizedClientProfileNote ?? undefined,
      },
      select: {
        id: true,
      },
    });

    return {
      client: updatedClient,
      normalizedFullName,
      normalizedEmail,
      normalizedPhone,
    };
  }

  const emailMatch = await tx.client.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      internalNote: true,
    },
  });
  const phoneMatches = normalizedPhone
    ? await tx.client.findMany({
        where: {
          phone: normalizedPhone,
        },
        select: {
          id: true,
          internalNote: true,
        },
        take: 3,
      })
    : [];
  const phoneMatch =
    phoneMatches.length === 1
      ? phoneMatches[0]
      : null;

  if (
    emailMatch
    && phoneMatch
    && emailMatch.id !== phoneMatch.id
  ) {
    throw new PublicBookingError(
      publicBookingErrorCodes.bookingConflict,
      "Telefon a e-mail odpovídají dvěma různým klientkám. Vyberte prosím existující profil ručně.",
      3,
    );
  }

  if (!emailMatch && phoneMatches.length > 1) {
    throw new PublicBookingError(
      publicBookingErrorCodes.bookingConflict,
      "Telefon odpovídá více klientkám. Vyberte prosím konkrétní profil ručně.",
      3,
    );
  }

  const matchedClient = emailMatch ?? phoneMatch;

  if (matchedClient) {
    const updatedClient = await tx.client.update({
      where: {
        id: matchedClient.id,
      },
      data: {
        fullName: normalizedFullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        isActive: true,
        lastBookedAt: now,
        internalNote: matchedClient.internalNote ?? normalizedClientProfileNote ?? undefined,
      },
      select: {
        id: true,
      },
    });

    return {
      client: updatedClient,
      normalizedFullName,
      normalizedEmail,
      normalizedPhone,
    };
  }

  const createdClient = await tx.client.create({
    data: {
      fullName: normalizedFullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      internalNote: normalizedClientProfileNote,
      isActive: true,
      lastBookedAt: now,
    },
    select: {
      id: true,
    },
  });

  return {
    client: createdClient,
    normalizedFullName,
    normalizedEmail,
    normalizedPhone,
  };
}

async function splitSlotForEditing(
  tx: Prisma.TransactionClient,
  slot: BookingSlotRecord,
  requestedStartsAt: Date,
  requestedEndsAt: Date,
) {
  const shouldSplitSlotForAdminEditing =
    slot.capacity === EDITABLE_SLOT_CAPACITY &&
    (requestedStartsAt.getTime() > slot.startsAt.getTime()
      || requestedEndsAt.getTime() < slot.endsAt.getTime());

  if (!shouldSplitSlotForAdminEditing) {
    return;
  }

  const beforeInterval =
    requestedStartsAt.getTime() > slot.startsAt.getTime()
      ? { startsAt: slot.startsAt, endsAt: requestedStartsAt }
      : null;
  const afterInterval =
    requestedEndsAt.getTime() < slot.endsAt.getTime()
      ? { startsAt: requestedEndsAt, endsAt: slot.endsAt }
      : null;

  await tx.availabilitySlot.update({
    where: {
      id: slot.id,
    },
    data: {
      startsAt: requestedStartsAt,
      endsAt: requestedEndsAt,
    },
  });

  const intervalFragments = [beforeInterval, afterInterval].filter(
    (fragment): fragment is { startsAt: Date; endsAt: Date } => fragment !== null,
  );

  for (const fragment of intervalFragments) {
    await tx.availabilitySlot.create({
      data: {
        startsAt: fragment.startsAt,
        endsAt: fragment.endsAt,
        capacity: slot.capacity,
        status: slot.status,
        serviceRestrictionMode: slot.serviceRestrictionMode,
        publicNote: slot.publicNote,
        internalNote: slot.internalNote,
        publishedAt: slot.publishedAt,
        cancelledAt: slot.cancelledAt,
        createdByUserId: slot.createdByUserId,
        allowedServices: slot.allowedServices.length > 0
          ? {
              createMany: {
                data: slot.allowedServices.map((allowedService) => ({
                  serviceId: allowedService.serviceId,
                })),
              },
            }
          : undefined,
      },
    });
  }
}

async function createNotificationEmailLogs(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    clientId: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string;
    serviceName: string;
    scheduledStartsAt: Date;
    scheduledEndsAt: Date;
    cancellationUrl: string;
    now: Date;
    status: "PENDING" | "CONFIRMED";
    sendClientEmail: boolean;
    includeCalendarAttachment: boolean;
    sendAdminNotification: boolean;
    adminNotificationEmail: string;
  },
) {
  const cancellationToken = buildBookingActionToken();
  const actionToken = await tx.bookingActionToken.create({
    data: {
      bookingId: input.bookingId,
      type: BookingActionTokenType.CANCEL,
      tokenHash: cancellationToken.tokenHash,
      expiresAt: buildBookingActionExpiry(input.now),
      lastSentAt: input.sendClientEmail ? input.now : null,
    },
    select: {
      id: true,
    },
  });

  const cancellationUrl = buildBookingCancellationUrl(cancellationToken.rawToken);

  if (input.sendClientEmail) {
    await tx.emailLog.create({
      data: {
        bookingId: input.bookingId,
        clientId: input.clientId,
        actionTokenId: actionToken.id,
        type: EmailLogType.BOOKING_CONFIRMED,
        status: env.EMAIL_DELIVERY_MODE === "background" ? undefined : EmailLogStatus.SENT,
        attemptCount: env.EMAIL_DELIVERY_MODE === "background" ? undefined : 1,
        nextAttemptAt: env.EMAIL_DELIVERY_MODE === "background" ? input.now : undefined,
        processingStartedAt: null,
        processingToken: null,
        recipientEmail: input.clientEmail,
        subject:
          input.status === BookingStatus.CONFIRMED
            ? `Rezervace potvrzena: ${input.serviceName}`
            : `Přijetí rezervace: ${input.serviceName}`,
        templateKey:
          input.status === BookingStatus.CONFIRMED
            ? "booking-approved-v1"
            : "booking-confirmation-v1",
        payload:
          input.status === BookingStatus.CONFIRMED
            ? {
                bookingId: input.bookingId,
                serviceName: input.serviceName,
                clientName: input.clientName,
                scheduledStartsAt: input.scheduledStartsAt.toISOString(),
                scheduledEndsAt: input.scheduledEndsAt.toISOString(),
                includeCalendarAttachment: input.includeCalendarAttachment,
              }
            : {
                bookingId: input.bookingId,
                serviceName: input.serviceName,
                clientName: input.clientName,
                scheduledStartsAt: input.scheduledStartsAt.toISOString(),
                scheduledEndsAt: input.scheduledEndsAt.toISOString(),
                cancellationUrl,
              },
        provider: env.EMAIL_DELIVERY_MODE === "background" ? undefined : "log",
        sentAt: env.EMAIL_DELIVERY_MODE === "background" ? undefined : input.now,
      },
    });
  }

  if (
    input.sendAdminNotification
    && input.status === BookingStatus.PENDING
    && input.adminNotificationEmail.trim().length > 0
  ) {
    const approveToken = buildBookingActionToken();
    const rejectToken = buildBookingActionToken();
    const approveUrl = buildBookingEmailActionUrl("approve", approveToken.rawToken);
    const rejectUrl = buildBookingEmailActionUrl("reject", rejectToken.rawToken);
    const adminUrl = `${env.NEXT_PUBLIC_APP_URL}/admin/rezervace/${input.bookingId}`;

    await tx.bookingActionToken.createMany({
      data: [
        {
          bookingId: input.bookingId,
          type: BookingActionTokenType.APPROVE,
          tokenHash: approveToken.tokenHash,
          expiresAt: buildBookingEmailActionExpiry(input.now),
          lastSentAt: input.now,
        },
        {
          bookingId: input.bookingId,
          type: BookingActionTokenType.REJECT,
          tokenHash: rejectToken.tokenHash,
          expiresAt: buildBookingEmailActionExpiry(input.now),
          lastSentAt: input.now,
        },
      ],
    });

    await tx.emailLog.create({
      data: {
        bookingId: input.bookingId,
        clientId: input.clientId,
        type: EmailLogType.BOOKING_CREATED,
        status: env.EMAIL_DELIVERY_MODE === "background" ? undefined : EmailLogStatus.SENT,
        attemptCount: env.EMAIL_DELIVERY_MODE === "background" ? undefined : 1,
        nextAttemptAt: env.EMAIL_DELIVERY_MODE === "background" ? input.now : undefined,
        processingStartedAt: null,
        processingToken: null,
        recipientEmail: input.adminNotificationEmail,
        subject: `Nová rezervace: ${input.serviceName}`,
        templateKey: "admin-booking-notification-v1",
        payload: {
          bookingId: input.bookingId,
          serviceName: input.serviceName,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          clientPhone: input.clientPhone,
          scheduledStartsAt: input.scheduledStartsAt.toISOString(),
          scheduledEndsAt: input.scheduledEndsAt.toISOString(),
          approveUrl,
          rejectUrl,
          adminUrl,
        },
        provider: env.EMAIL_DELIVERY_MODE === "background" ? undefined : "log",
        sentAt: env.EMAIL_DELIVERY_MODE === "background" ? undefined : input.now,
      },
    });
  }

  return {
    cancellationUrl,
  };
}

async function createBookingWithEngine(
  input: SharedCreateBookingInput,
): Promise<SharedCreateBookingResult> {
  const normalizedClientNote = input.clientNote ? normalizeWhitespace(input.clientNote) : undefined;
  const normalizedInternalNote = input.internalNote ? normalizeWhitespace(input.internalNote) : undefined;
  const requestedStartsAt = new Date(input.startsAt);
  const isRequestedStartsAtValid = !Number.isNaN(requestedStartsAt.getTime());
  const [bookingPolicy, emailBranding] = await Promise.all([
    getBookingPolicySettings(),
    getEmailBrandingSettings(),
  ]);

  if (!isRequestedStartsAtValid) {
    throw new PublicBookingError(
      publicBookingErrorCodes.slotUnavailable,
      "Vybraný termín už není dostupný.",
      2,
    );
  }

  if (!isValidNormalizedClientPhone(normalizeClientPhone(input.client.phone))) {
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
          const service = await loadServiceForBooking(tx, input.serviceId);
          const requestedEndsAt = new Date(
            requestedStartsAt.getTime() + service.durationMinutes * 60 * 1000,
          );

          const slot = input.slotId
            ? await lockRequestedSlot(tx, input.slotId)
            : null;

          if (input.slotId && !slot) {
            throw new PublicBookingError(
              publicBookingErrorCodes.slotUnavailable,
              "Vybraný termín už není dostupný.",
              2,
            );
          }

          const overlappingSlots = await tx.availabilitySlot.findMany({
            where: {
              id: slot ? { not: slot.id } : undefined,
              startsAt: {
                lt: requestedEndsAt,
              },
              endsAt: {
                gt: requestedStartsAt,
              },
            },
            select: {
              id: true,
              startsAt: true,
              endsAt: true,
              capacity: true,
              status: true,
              serviceRestrictionMode: true,
              publicNote: true,
              internalNote: true,
              publishedAt: true,
              cancelledAt: true,
              createdByUserId: true,
              allowedServices: {
                select: {
                  serviceId: true,
                },
              },
            },
            orderBy: [{ startsAt: "asc" }],
          });

          const matchingPublishedSlot =
            slot?.status === AvailabilitySlotStatus.PUBLISHED
              ? slot
              : overlappingSlots.find(
                  (candidate) =>
                    candidate.status === AvailabilitySlotStatus.PUBLISHED
                    && requestedStartsAt >= candidate.startsAt
                    && requestedEndsAt <= candidate.endsAt,
                ) ?? null;
          const blockingSlots = overlappingSlots.filter(
            (candidate) => candidate.status !== AvailabilitySlotStatus.PUBLISHED,
          );

          if (blockingSlots.length > 0) {
            throw new PublicBookingError(
              publicBookingErrorCodes.bookingConflict,
              "Vybraný termín zasahuje do interně blokovaného času.",
              2,
            );
          }

          let resolvedSlot = slot ?? matchingPublishedSlot;
          let manualOverride = false;
          const isWithinPublicWindow = isBookingWithinWindow(
            requestedStartsAt,
            now,
            bookingPolicy.minAdvanceHours,
            bookingPolicy.maxAdvanceDays,
          );

          if (resolvedSlot) {
            if (!doesSlotSupportServiceDuration(resolvedSlot.startsAt, resolvedSlot.endsAt, service.durationMinutes)) {
              throw new PublicBookingError(
                publicBookingErrorCodes.slotTooShort,
                "Vybraný termín už neodpovídá délce služby. Vyberte prosím jiný.",
                2,
              );
            }

            if (requestedStartsAt < resolvedSlot.startsAt || requestedEndsAt > resolvedSlot.endsAt) {
              if (!input.allowManualOverride) {
                throw new PublicBookingError(
                  publicBookingErrorCodes.slotUnavailable,
                  "Vybraný termín už není dostupný.",
                  2,
                );
              }

              resolvedSlot = null;
              manualOverride = true;
            } else {
              const slotAllowsService = !(
                resolvedSlot.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.SELECTED
                && !resolvedSlot.allowedServices.some((allowedService) => allowedService.serviceId === service.id)
              );
              const isPubliclyAvailable =
                resolvedSlot.status === AvailabilitySlotStatus.PUBLISHED
                && isWithinPublicWindow
                && slotAllowsService;

              if (!isPubliclyAvailable) {
                if (!input.allowManualOverride) {
                  throw new PublicBookingError(
                    slotAllowsService
                      ? publicBookingErrorCodes.slotUnavailable
                      : publicBookingErrorCodes.slotNotAllowed,
                    slotAllowsService
                      ? "Vybraný termín už není dostupný."
                      : "Vybraný termín není pro tuto službu dostupný.",
                    2,
                  );
                }

                manualOverride = true;
              }
            }
          } else if (!input.allowManualOverride) {
            throw new PublicBookingError(
              publicBookingErrorCodes.slotUnavailable,
              "Vybraný termín už není dostupný.",
              2,
            );
          } else {
            manualOverride = true;
          }

          const activeBookingCount = await tx.booking.count({
            where: {
              status: {
                in: [...ACTIVE_BOOKING_STATUSES],
              },
              scheduledStartsAt: {
                lt: requestedEndsAt,
              },
              scheduledEndsAt: {
                gt: requestedStartsAt,
              },
              ...(manualOverride || !resolvedSlot
                ? {}
                : {
                    slotId: resolvedSlot.id,
                  }),
            },
          });

          const allowedCapacity = manualOverride || !resolvedSlot ? 1 : resolvedSlot.capacity;

          if (activeBookingCount >= allowedCapacity) {
            throw new PublicBookingError(
              publicBookingErrorCodes.slotUnavailable,
              "Vybraný termín koliduje s jinou rezervací.",
              2,
            );
          }

          if (!resolvedSlot) {
            resolvedSlot = await tx.availabilitySlot.create({
              data: {
                startsAt: requestedStartsAt,
                endsAt: requestedEndsAt,
                capacity: EDITABLE_SLOT_CAPACITY,
                status: AvailabilitySlotStatus.DRAFT,
                serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
                internalNote: normalizedInternalNote
                  ? `Interní výjimka: ${normalizedInternalNote}`
                  : "Interní výjimka pro ručně vytvořenou rezervaci.",
                createdByUserId: input.actorUserId ?? null,
              },
              select: {
                id: true,
                startsAt: true,
                endsAt: true,
                capacity: true,
                status: true,
                serviceRestrictionMode: true,
                publicNote: true,
                internalNote: true,
                publishedAt: true,
                cancelledAt: true,
                createdByUserId: true,
                allowedServices: {
                  select: {
                    serviceId: true,
                  },
                },
              },
            });
          }

          const {
            client,
            normalizedFullName,
            normalizedEmail,
            normalizedPhone,
          } = await resolveClientForBooking(tx, input.client, now);

          const existingClientBooking = await tx.booking.findFirst({
            where: {
              clientId: client.id,
              status: {
                in: [...ACTIVE_BOOKING_STATUSES],
              },
              scheduledStartsAt: requestedStartsAt,
              scheduledEndsAt: requestedEndsAt,
            },
            select: {
              id: true,
            },
          });

          if (existingClientBooking) {
            throw new PublicBookingError(
              publicBookingErrorCodes.slotAlreadyBookedByClient,
              "Tento konkrétní čas už má klientka v systému rezervovaný.",
              2,
            );
          }

          const booking = await tx.booking.create({
            data: {
              clientId: client.id,
              slotId: resolvedSlot.id,
              serviceId: service.id,
              source: input.source,
              isManual: input.isManual,
              manualOverride,
              status: input.status,
              clientNameSnapshot: normalizedFullName,
              clientEmailSnapshot: normalizedEmail,
              clientPhoneSnapshot: normalizedPhone,
              serviceNameSnapshot: service.name,
              serviceDurationMinutes: service.durationMinutes,
              servicePriceFromCzk: service.priceFromCzk,
              scheduledStartsAt: requestedStartsAt,
              scheduledEndsAt: requestedEndsAt,
              clientNote: normalizedClientNote,
              internalNote: normalizedInternalNote,
              confirmedAt: input.status === BookingStatus.CONFIRMED ? now : null,
              createdByUserId: input.actorUserId ?? null,
            },
            select: {
              id: true,
              scheduledStartsAt: true,
              scheduledEndsAt: true,
            },
          });

          if (resolvedSlot.status === AvailabilitySlotStatus.PUBLISHED) {
            await splitSlotForEditing(tx, resolvedSlot, requestedStartsAt, requestedEndsAt);
          }

          await tx.bookingStatusHistory.create({
            data: {
              bookingId: booking.id,
              status: input.status,
              actorType: input.actorType,
              actorUserId: input.actorUserId ?? null,
              reason: input.historyReason,
              note: normalizedInternalNote ?? null,
              metadata: {
                ...(input.historyMetadata && typeof input.historyMetadata === "object"
                  ? input.historyMetadata
                  : {}),
                source: input.source,
                isManual: input.isManual,
                manualOverride,
              },
            },
          });

          const notifications = await createNotificationEmailLogs(tx, {
            bookingId: booking.id,
            clientId: client.id,
            clientName: normalizedFullName,
            clientEmail: normalizedEmail,
            clientPhone: normalizedPhone,
            serviceName: service.name,
            scheduledStartsAt: booking.scheduledStartsAt,
            scheduledEndsAt: booking.scheduledEndsAt,
            cancellationUrl: "",
            now,
            status: input.status,
            sendClientEmail: input.sendClientEmail,
            includeCalendarAttachment: input.includeCalendarAttachment,
            sendAdminNotification: input.sendAdminNotification,
            adminNotificationEmail: emailBranding.notificationAdminEmail,
          });

          return {
            bookingId: booking.id,
            referenceCode: booking.id.slice(-8).toUpperCase(),
            serviceName: service.name,
            scheduledStartsAt: booking.scheduledStartsAt.toISOString(),
            scheduledEndsAt: booking.scheduledEndsAt.toISOString(),
            scheduledAtLabel: formatBookingDateLabel(
              booking.scheduledStartsAt,
              booking.scheduledEndsAt,
            ),
            clientName: normalizedFullName,
            clientEmail: normalizedEmail,
            cancellationUrl: notifications.cancellationUrl,
            emailDeliveryStatus:
              input.sendClientEmail || input.sendAdminNotification
                ? env.EMAIL_DELIVERY_MODE === "background"
                  ? "queued"
                  : "logged"
                : "skipped",
            status: input.status,
            manualOverride,
          } satisfies SharedCreateBookingResult;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return transactionResult;
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

export async function getPublicBookingCatalog(): Promise<PublicBookingCatalog> {
  const now = new Date();
  const bookingPolicy = await getBookingPolicySettings();
  const bookingWindowStart = new Date(
    now.getTime() + bookingPolicy.minAdvanceHours * 60 * 60 * 1000,
  );
  const bookingWindowEnd = new Date(
    now.getTime() + bookingPolicy.maxAdvanceDays * 24 * 60 * 60 * 1000,
  );

  const [services, slots] = await Promise.all([
    prisma.service.findMany({
      where: {
        isActive: true,
        isPubliclyBookable: true,
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
          gte: bookingWindowStart,
          lte: bookingWindowEnd,
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
            scheduledStartsAt: true,
            scheduledEndsAt: true,
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
        capacity: slot.capacity,
        serviceRestrictionMode: slot.serviceRestrictionMode,
        allowedServiceIds: slot.allowedServices.map((allowedService) => allowedService.serviceId),
        bookedIntervals: slot.bookings.map((booking) => ({
          startsAt: booking.scheduledStartsAt.toISOString(),
          endsAt: booking.scheduledEndsAt.toISOString(),
        })),
      }))
      .filter((slot) => slot.capacity > 0),
  };
}

export async function createPublicBooking(
  input: CreatePublicBookingInput,
): Promise<CreatePublicBookingResult> {
  const result = await createBookingWithEngine({
    serviceId: input.serviceId,
    slotId: input.slotId,
    startsAt: input.startsAt,
    client: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
    },
    clientNote: input.clientNote,
    source: BookingSource.WEB,
    status: BookingStatus.PENDING,
    isManual: false,
    allowManualOverride: false,
    actorType: BookingActorType.CLIENT,
    historyReason: "public-booking-request-v1",
    historyMetadata: {
      source: "public-booking-request-v1",
    },
    sendClientEmail: true,
    includeCalendarAttachment: false,
    sendAdminNotification: true,
  });

  return {
    bookingId: result.bookingId,
    referenceCode: result.referenceCode,
    serviceName: result.serviceName,
    scheduledStartsAt: result.scheduledStartsAt,
    scheduledEndsAt: result.scheduledEndsAt,
    scheduledAtLabel: result.scheduledAtLabel,
    clientName: result.clientName,
    clientEmail: result.clientEmail,
    cancellationUrl: result.cancellationUrl,
    emailDeliveryStatus: result.emailDeliveryStatus,
  };
}

export async function createManualBooking(
  input: CreateManualBookingInput,
): Promise<CreateManualBookingResult> {
  return createBookingWithEngine({
    serviceId: input.serviceId,
    slotId: input.slotId,
    startsAt: input.startsAt,
    client: {
      selectedClientId: input.selectedClientId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      clientProfileNote: input.clientProfileNote,
    },
    clientNote: input.clientNote,
    internalNote: input.internalNote,
    source: input.source,
    status: input.status,
    isManual: true,
    allowManualOverride: true,
    actorType: BookingActorType.USER,
    actorUserId: input.actorUserId,
    historyReason: "admin-manual-booking-v1",
    historyMetadata: {
      source: "admin-manual-booking-v1",
    },
    sendClientEmail: input.sendClientEmail,
    includeCalendarAttachment: input.includeCalendarAttachment,
    sendAdminNotification: false,
  });
}
