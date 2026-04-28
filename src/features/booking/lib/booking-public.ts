import {
  BookingActorType,
  BookingSource,
  BookingStatus,
} from "@prisma/client";

import {
  validateVoucherForBookingInput,
  voucherValidationReasonCodes,
} from "@/features/vouchers/lib/voucher-validation";

import { createBookingWithEngine } from "./booking-public/engine";
import {
  PublicBookingError,
  publicBookingErrorCodes,
} from "./booking-public/shared";

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

function getPublicVoucherValidationMessage(reason: string) {
  switch (reason) {
    case voucherValidationReasonCodes.notFound:
      return "Voucher nebyl nalezen.";
    case voucherValidationReasonCodes.draft:
      return "Voucher zatím není aktivní.";
    case voucherValidationReasonCodes.cancelled:
      return "Voucher se nepodařilo ověřit. Zkontrolujte prosím kód.";
    case voucherValidationReasonCodes.redeemed:
      return "Voucher už byl uplatněn.";
    case voucherValidationReasonCodes.expired:
      return "Voucher je propadlý.";
    case voucherValidationReasonCodes.serviceMismatch:
      return "Tento voucher je určený pro jinou službu.";
    case voucherValidationReasonCodes.noRemainingValue:
      return "Voucher už nemá žádný dostupný zůstatek.";
    case voucherValidationReasonCodes.invalidInput:
    default:
      return "Voucher se nepodařilo ověřit. Zkontrolujte prosím kód.";
  }
}

export async function createPublicBooking(
  input: CreatePublicBookingInput,
): Promise<CreatePublicBookingResult> {
  const normalizedVoucherCodeInput = input.voucherCode?.trim() ?? "";
  const intendedVoucher = normalizedVoucherCodeInput
    ? await validateVoucherForBookingInput({
        code: normalizedVoucherCodeInput,
        serviceId: input.serviceId,
      })
    : null;

  if (intendedVoucher && !intendedVoucher.ok) {
    throw new PublicBookingError(
      publicBookingErrorCodes.voucherInvalid,
      getPublicVoucherValidationMessage(intendedVoucher.reason),
      3,
    );
  }

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
    intendedVoucher: intendedVoucher?.ok
      ? {
          id: intendedVoucher.voucherId,
          code: intendedVoucher.code,
          type: intendedVoucher.type,
        }
      : null,
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
    intendedVoucherCode: result.intendedVoucherCode,
    intendedVoucherType: result.intendedVoucherType,
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
