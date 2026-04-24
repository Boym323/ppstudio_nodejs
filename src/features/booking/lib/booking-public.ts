import {
  BookingActorType,
  BookingSource,
  BookingStatus,
} from "@prisma/client";

import { createBookingWithEngine } from "./booking-public/engine";

export {
  PublicBookingError,
  isValidNormalizedClientPhone,
  normalizeClientEmail,
  normalizeClientPhone,
  publicBookingErrorCodes,
} from "./booking-public/shared";
export type {
  CreateManualBookingInput,
  CreateManualBookingResult,
  CreatePublicBookingInput,
  CreatePublicBookingResult,
  PublicBookingCatalog,
  PublicBookingErrorCode,
} from "./booking-public/shared";
export { getPublicBookingCatalog } from "./booking-public/catalog";

import type {
  CreateManualBookingInput,
  CreateManualBookingResult,
  CreatePublicBookingInput,
  CreatePublicBookingResult,
} from "./booking-public/shared";

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
      acquisitionSource: input.acquisition.source,
      acquisitionReferrerHost: input.acquisition.referrerHost,
      acquisitionUtmSource: input.acquisition.utmSource,
      acquisitionUtmMedium: input.acquisition.utmMedium,
      acquisitionUtmCampaign: input.acquisition.utmCampaign,
    },
    sendClientEmail: true,
    includeCalendarAttachment: false,
    sendAdminNotification: true,
    acquisition: input.acquisition,
  });

  return {
    bookingId: result.bookingId,
    serviceName: result.serviceName,
    scheduledStartsAt: result.scheduledStartsAt,
    scheduledEndsAt: result.scheduledEndsAt,
    scheduledAtLabel: result.scheduledAtLabel,
    clientName: result.clientName,
    clientEmail: result.clientEmail,
    manageReservationUrl: result.manageReservationUrl,
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
    deliverEmailImmediately: input.deliverEmailImmediately,
    sendAdminNotification: false,
  });
}
