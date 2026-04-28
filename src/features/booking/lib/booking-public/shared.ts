import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingAcquisitionSource,
  BookingActorType,
  BookingSource,
  BookingStatus,
  Prisma,
} from "@prisma/client";

export const ACTIVE_BOOKING_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;
export const MAX_BOOKING_TRANSACTION_RETRIES = 5;
export const EDITABLE_SLOT_CAPACITY = 1;

export const publicBookingErrorCodes = {
  serviceUnavailable: "SERVICE_UNAVAILABLE",
  slotUnavailable: "SLOT_UNAVAILABLE",
  slotNotAllowed: "SLOT_NOT_ALLOWED",
  slotTooShort: "SLOT_TOO_SHORT",
  slotAlreadyBookedByClient: "SLOT_ALREADY_BOOKED_BY_CLIENT",
  voucherInvalid: "VOUCHER_INVALID",
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
    segments?: Array<{
      id: string;
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
  voucherCode?: string;
  acquisition: {
    source: BookingAcquisitionSource;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    referrerHost: string | null;
  };
};

export type CreatePublicBookingResult = {
  bookingId: string;
  serviceName: string;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  scheduledAtLabel: string;
  clientName: string;
  clientEmail: string;
  manageReservationUrl: string;
  cancellationUrl: string;
  emailDeliveryStatus: "queued" | "logged" | "skipped";
  intendedVoucherCode?: string;
  intendedVoucherType?: "VALUE" | "SERVICE";
};

export type CreateManualBookingInput = {
  serviceId: string;
  startsAt: string;
  slotId?: string;
  selectedClientId?: string;
  fullName: string;
  email?: string;
  phone?: string;
  clientProfileNote?: string;
  clientNote?: string;
  internalNote?: string;
  source: BookingSource;
  status: "PENDING" | "CONFIRMED";
  actorUserId: string | null;
  sendClientEmail: boolean;
  includeCalendarAttachment: boolean;
  deliverEmailImmediately?: boolean;
};

export type CreateManualBookingResult = CreatePublicBookingResult & {
  status: "PENDING" | "CONFIRMED";
  manualOverride: boolean;
};

export type LockedSlotRow = {
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

export function normalizeWhitespace(value: string) {
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

export function doesSlotSupportServiceDuration(
  startsAt: Date,
  endsAt: Date,
  serviceDurationMinutes: number,
) {
  return endsAt.getTime() - startsAt.getTime() >= serviceDurationMinutes * 60 * 1000;
}

export function isRetryablePrismaError(error: unknown) {
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

export function mapKnownPrismaError(error: Prisma.PrismaClientKnownRequestError) {
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

export type BookingServiceRecord = {
  id: string;
  name: string;
  durationMinutes: number;
  priceFromCzk: number | null;
};

export type BookingSlotRecord = {
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

export type ClientResolutionInput = {
  selectedClientId?: string;
  fullName: string;
  email?: string;
  phone?: string;
  clientProfileNote?: string;
};

export type SharedCreateBookingInput = {
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
  deliverEmailImmediately?: boolean;
  sendAdminNotification: boolean;
  acquisition?: {
    source: BookingAcquisitionSource;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    referrerHost: string | null;
  };
  intendedVoucher?: {
    id: string;
    code: string;
    type: "VALUE" | "SERVICE";
  } | null;
};

export type SharedCreateBookingResult = {
  bookingId: string;
  serviceName: string;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  scheduledAtLabel: string;
  clientName: string;
  clientEmail: string;
  manageReservationUrl: string;
  cancellationUrl: string;
  createdEmailLogIds: string[];
  emailDeliveryStatus: "queued" | "logged" | "skipped";
  status: "PENDING" | "CONFIRMED";
  manualOverride: boolean;
  intendedVoucherCode?: string;
  intendedVoucherType?: "VALUE" | "SERVICE";
};
