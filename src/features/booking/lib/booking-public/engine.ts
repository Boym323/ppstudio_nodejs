import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingStatus,
  Prisma,
} from "@prisma/client";

import { env } from "@/config/env";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
import { deliverEmailLog } from "@/lib/email/delivery";
import { sendOwnerBookingPushover } from "@/lib/notifications/pushover";
import { prisma } from "@/lib/prisma";
import {
  getBookingPolicySettings,
  getEmailBrandingSettings,
  isBookingWithinWindow,
} from "@/lib/site-settings";

import { createNotificationEmailLogs } from "./notifications";
import {
  ACTIVE_BOOKING_STATUSES,
  EDITABLE_SLOT_CAPACITY,
  MAX_BOOKING_TRANSACTION_RETRIES,
  type BookingServiceRecord,
  type BookingSlotRecord,
  type ClientResolutionInput,
  type LockedSlotRow,
  type SharedCreateBookingInput,
  type SharedCreateBookingResult,
  PublicBookingError,
  isRetryablePrismaError,
  isValidNormalizedClientPhone,
  mapKnownPrismaError,
  normalizeClientEmail,
  normalizeClientPhone,
  normalizeWhitespace,
  publicBookingErrorCodes,
} from "./shared";
import { resolvePublishedSlotCoverage } from "../booking-slot-availability";

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
  const normalizedEmail = input.email ? normalizeClientEmail(input.email) : undefined;
  const normalizedPhone = normalizeClientPhone(input.phone);
  const normalizedClientProfileNote = input.clientProfileNote
    ? normalizeWhitespace(input.clientProfileNote)
    : undefined;

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
        email: normalizedEmail ?? null,
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
      normalizedEmail: normalizedEmail ?? "",
      normalizedPhone,
    };
  }

  const emailMatch = normalizedEmail
    ? await tx.client.findUnique({
        where: {
          email: normalizedEmail,
        },
        select: {
          id: true,
          internalNote: true,
        },
      })
    : null;
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
  const phoneMatch = phoneMatches.length === 1 ? phoneMatches[0] : null;

  if (
    emailMatch &&
    phoneMatch &&
    emailMatch.id !== phoneMatch.id
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
      normalizedEmail: normalizedEmail ?? "",
      normalizedPhone,
    };
  }

  const createdClient = await tx.client.create({
    data: {
      fullName: normalizedFullName,
      email: normalizedEmail ?? null,
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
    normalizedEmail: normalizedEmail ?? "",
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
    (requestedStartsAt.getTime() > slot.startsAt.getTime() ||
      requestedEndsAt.getTime() < slot.endsAt.getTime());

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

export async function createBookingWithEngine(
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

          const publishedCoverage = resolvePublishedSlotCoverage(
            [slot, ...overlappingSlots].filter(
              (candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate),
            ),
            service.id,
            requestedStartsAt,
            requestedEndsAt,
            slot?.id,
          );

          if (
            slot &&
            publishedCoverage === null &&
            requestedStartsAt >= slot.startsAt &&
            requestedStartsAt < slot.endsAt &&
            requestedEndsAt > slot.endsAt
          ) {
            throw new PublicBookingError(
              publicBookingErrorCodes.slotTooShort,
              "Vybraný termín už neodpovídá délce služby. Vyberte prosím jiný.",
              2,
            );
          }

          let resolvedSlot = slot ?? publishedCoverage?.anchor ?? null;
          let resolvedCoverageSlots = publishedCoverage?.coverage ?? (resolvedSlot ? [resolvedSlot] : []);
          let manualOverride = false;
          const isWithinPublicWindow = isBookingWithinWindow(
            requestedStartsAt,
            now,
            bookingPolicy.minAdvanceHours,
            bookingPolicy.maxAdvanceDays,
          );

          if (resolvedSlot) {
            const coveredUntil = resolvedCoverageSlots.length > 0
              ? resolvedCoverageSlots[resolvedCoverageSlots.length - 1]?.endsAt ?? resolvedSlot.endsAt
              : resolvedSlot.endsAt;

            if (requestedStartsAt < resolvedSlot.startsAt || requestedEndsAt > coveredUntil) {
              if (!input.allowManualOverride) {
                throw new PublicBookingError(
                  publicBookingErrorCodes.slotUnavailable,
                  "Vybraný termín už není dostupný.",
                  2,
                );
              }

              resolvedSlot = null;
              resolvedCoverageSlots = [];
              manualOverride = true;
            } else {
              const isPubliclyAvailable =
                resolvedCoverageSlots.length > 0 &&
                isWithinPublicWindow;

              if (!isPubliclyAvailable) {
                if (!input.allowManualOverride) {
                  throw new PublicBookingError(
                    publicBookingErrorCodes.slotUnavailable,
                    "Vybraný termín už není dostupný.",
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
                    slotId: {
                      in: resolvedCoverageSlots.map((coverageSlot) => coverageSlot.id),
                    },
                  }),
            },
          });

          const allowedCapacity = manualOverride || !resolvedSlot
            ? 1
            : Math.min(...resolvedCoverageSlots.map((coverageSlot) => coverageSlot.capacity));

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
              acquisitionSource: input.acquisition?.source ?? null,
              acquisitionReferrerHost: input.acquisition?.referrerHost ?? null,
              acquisitionUtmSource: input.acquisition?.utmSource ?? null,
              acquisitionUtmMedium: input.acquisition?.utmMedium ?? null,
              acquisitionUtmCampaign: input.acquisition?.utmCampaign ?? null,
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

          if (resolvedSlot.status === AvailabilitySlotStatus.PUBLISHED && resolvedCoverageSlots.length === 1) {
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
                acquisitionSource: input.acquisition?.source ?? null,
                acquisitionReferrerHost: input.acquisition?.referrerHost ?? null,
                acquisitionUtmSource: input.acquisition?.utmSource ?? null,
                acquisitionUtmMedium: input.acquisition?.utmMedium ?? null,
                acquisitionUtmCampaign: input.acquisition?.utmCampaign ?? null,
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
            now,
            status: input.status,
            sendClientEmail: input.sendClientEmail && normalizedEmail.length > 0,
            includeCalendarAttachment: input.includeCalendarAttachment,
            sendAdminNotification: input.sendAdminNotification,
            adminNotificationEmail: emailBranding.notificationAdminEmail,
          });

          return {
            bookingId: booking.id,
            serviceName: service.name,
            scheduledStartsAt: booking.scheduledStartsAt.toISOString(),
            scheduledEndsAt: booking.scheduledEndsAt.toISOString(),
            scheduledAtLabel: formatBookingDateLabel(
              booking.scheduledStartsAt,
              booking.scheduledEndsAt,
            ),
            clientName: normalizedFullName,
            clientEmail: normalizedEmail,
            manageReservationUrl: notifications.manageReservationUrl,
            cancellationUrl: notifications.cancellationUrl,
            createdEmailLogIds: notifications.createdEmailLogIds,
            emailDeliveryStatus:
              (input.sendClientEmail && normalizedEmail.length > 0) || input.sendAdminNotification
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

      if (input.isManual && input.sendClientEmail && input.deliverEmailImmediately) {
        for (const emailLogId of transactionResult.createdEmailLogIds) {
          await deliverEmailLog(emailLogId);
        }
      }

      await sendOwnerBookingPushover({
        type: input.status === BookingStatus.CONFIRMED
          ? "BOOKING_CONFIRMED"
          : input.isManual
            ? "BOOKING_PENDING"
            : "NEW_BOOKING",
        bookingId: transactionResult.bookingId,
        sourceLabel: input.isManual ? input.source : "Web",
      });

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
