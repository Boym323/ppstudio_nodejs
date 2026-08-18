"use server";

import { BookingSubmissionOutcome, Prisma } from "@/generated/prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { z } from "zod";

import { env } from "@/config/env";
import { getTrustedClientIp } from "@/lib/http/trusted-client-ip";
import { prisma } from "@/lib/prisma";
import { consumeAtomicRateLimit, releaseAtomicRateLimitReservation } from "@/lib/security/atomic-rate-limit";
import {
  BOOKING_ACQUISITION_COOKIE,
  parseBookingAcquisitionCookie,
} from "@/features/booking/lib/booking-acquisition";
import {
  CLIENT_PHONE_FORMAT_MESSAGE,
  createPublicBooking,
  isValidClientPhoneInput,
  isSlotUnavailableDueToBookingConflict,
  normalizeClientEmail,
  normalizeClientPhone,
  PublicBookingError,
  publicBookingErrorCodes,
} from "@/features/booking/lib/booking-public";
import { type PublicBookingActionState } from "@/features/booking/actions/public-booking-action-state";
import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";

const availabilityRefreshMessage =
  "Tento termín byl mezitím obsazen. Nabídku jsme aktualizovali, vyberte prosím jiný čas.";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

const BOOKING_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP = 8;
const MAX_FAILED_ATTEMPTS_PER_EMAIL = 3;
const BOOKING_IP_RATE_LIMIT_SCOPE = "public-booking-ip";
const BOOKING_EMAIL_RATE_LIMIT_SCOPE = "public-booking-email-failure";
const publicBookingSchema = z.object({
  serviceId: z.string().trim().min(1, "Vyberte službu.").max(64, "Vyberte službu z nabídky."),
  slotId: z.string().trim().min(1, "Vyberte termín.").max(64, "Vyberte termín z nabídky."),
  startsAt: z.string().trim().min(1, "Vyberte začátek rezervace."),
  fullName: z
    .string()
    .trim()
    .min(3, "Zadejte celé jméno a příjmení.")
    .max(120, "Jméno je příliš dlouhé.")
    .refine((value) => value.replace(/[^\p{L}]/gu, "").length >= 2, {
      message: "Zadejte platné jméno.",
    }),
  email: z.email("Zadejte platný e-mail.").max(254, "E-mail je příliš dlouhý."),
  phone: z
    .string()
    .trim()
    .max(32, "Telefon je příliš dlouhý.")
    .refine((value) => isValidClientPhoneInput(value), {
      message: CLIENT_PHONE_FORMAT_MESSAGE,
    })
    .optional()
    .or(z.literal("")),
  clientNote: z
    .string()
    .trim()
    .max(600, "Poznámka je příliš dlouhá.")
    .optional()
    .or(z.literal("")),
  voucherCode: z
    .string()
    .trim()
    .max(64, "Kód voucheru je příliš dlouhý.")
    .optional()
    .or(z.literal("")),
});

function hashSubmissionFingerprint(value: string) {
  return createHash("sha256").update(`${env.ADMIN_SESSION_SECRET}:${value}`).digest("hex");
}

function isBookingSchemaDriftError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;

  return (
    message.includes("BookingActionTokenType")
    || message.includes("APPROVE")
    || message.includes("REJECT")
    || message.includes("invalid input value for enum")
  );
}

function getPublicFacingBookingErrorMessage(error: PublicBookingError) {
  if (
    error.suggestedStep === 2
    && (
      error.code === publicBookingErrorCodes.bookingConflict
      || error.code === publicBookingErrorCodes.slotUnavailable
      || error.code === publicBookingErrorCodes.slotNotAllowed
      || error.code === publicBookingErrorCodes.slotTooShort
    )
  ) {
    return availabilityRefreshMessage;
  }

  if (error.code === publicBookingErrorCodes.bookingConflict && error.suggestedStep === 3) {
    return "Údaje se nepodařilo bezpečně ověřit. Zkontrolujte prosím e-mail a telefon, nebo kontaktujte PP Studio ve Zlíně a rezervaci dokončíme společně.";
  }

  return error.message;
}

function extractClientIp(requestHeaders: Headers) {
  return getTrustedClientIp(requestHeaders);
}

function getSubmissionMetadata(requestHeaders: Headers) {
  const clientIp = extractClientIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 256) ?? undefined;

  return {
    ipHash: clientIp ? hashSubmissionFingerprint(clientIp) : undefined,
    userAgent,
  };
}

async function writeSubmissionLog(
  data: Prisma.BookingSubmissionLogUncheckedCreateInput & {
    outcome: BookingSubmissionOutcome;
    failureCode?: string;
    failureReason?: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  try {
    await prisma.bookingSubmissionLog.create({
      data,
    });
  } catch (error) {
    console.error("Failed to write booking submission audit log", error);
  }
}

export async function createPublicBookingAction(
  _previousState: PublicBookingActionState,
  formData: FormData,
): Promise<PublicBookingActionState> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const acquisitionData = parseBookingAcquisitionCookie(
    cookieStore.get(BOOKING_ACQUISITION_COOKIE)?.value,
  );
  const submissionMetadata = getSubmissionMetadata(requestHeaders);
  const parsed = publicBookingSchema.safeParse({
    serviceId: readFormString(formData, "serviceId"),
    slotId: readFormString(formData, "slotId"),
    startsAt: readFormString(formData, "startsAt"),
    fullName: readFormString(formData, "fullName"),
    email: readFormString(formData, "email"),
    phone: readFormString(formData, "phone"),
    clientNote: readFormString(formData, "clientNote"),
    voucherCode: readFormString(formData, "voucherCode"),
  });
  const normalizedEmailForAudit = normalizeClientEmail(readFormString(formData, "email"));
  const emailHash = normalizedEmailForAudit ? hashSubmissionFingerprint(normalizedEmailForAudit) : undefined;

  const ipRateLimit = await consumeAtomicRateLimit({ scope: BOOKING_IP_RATE_LIMIT_SCOPE, fingerprint: submissionMetadata.ipHash, limit: MAX_ATTEMPTS_PER_IP, windowMs: BOOKING_ATTEMPT_WINDOW_MS });
  const emailRateLimit = ipRateLimit.allowed
    ? await consumeAtomicRateLimit({ scope: BOOKING_EMAIL_RATE_LIMIT_SCOPE, fingerprint: emailHash, limit: MAX_FAILED_ATTEMPTS_PER_EMAIL, windowMs: BOOKING_ATTEMPT_WINDOW_MS })
    : { allowed: false, attempts: 0 };
  const ipAttempts = ipRateLimit.attempts;
  const emailFailures = emailRateLimit.attempts;

  if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
    await writeSubmissionLog({
      outcome: BookingSubmissionOutcome.BLOCKED,
      ipHash: submissionMetadata.ipHash,
      emailHash,
      userAgent: submissionMetadata.userAgent,
      failureCode: "RATE_LIMITED",
      failureReason: "Příliš mnoho pokusů v krátkém čase.",
      metadata: {
        ipAttempts,
        emailFailures,
        acquisition: acquisitionData,
      },
    });

    await sendOwnerSystemErrorPushover({
      title: "PP Studio - omezeny pocet pokusu o rezervaci",
      message: "Verejny formular rezervace narazil na rate limit.",
      context: {
        contextId: submissionMetadata.ipHash ?? "public-booking-rate-limited",
        ipAttempts,
        emailFailures,
      },
    });

    await releaseAtomicRateLimitReservation(emailRateLimit.reservationId);

    return {
      status: "error",
      formError: "Odeslali jste příliš mnoho pokusů. Počkejte prosím chvíli a zkuste to znovu.",
      errorCode: "RATE_LIMITED",
      suggestedStep: 4,
    };
  }

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    await writeSubmissionLog({
      outcome: BookingSubmissionOutcome.FAILED,
      ipHash: submissionMetadata.ipHash,
      emailHash,
      userAgent: submissionMetadata.userAgent,
      failureCode: "VALIDATION_ERROR",
      failureReason: "Formulář potřebuje doplnit nebo opravit.",
      metadata: {
        fieldErrors: {
          serviceId: fieldErrors.serviceId?.[0],
          slotId: fieldErrors.slotId?.[0],
          startsAt: fieldErrors.startsAt?.[0],
          fullName: fieldErrors.fullName?.[0],
          email: fieldErrors.email?.[0],
          phone: fieldErrors.phone?.[0],
          clientNote: fieldErrors.clientNote?.[0],
          voucherCode: fieldErrors.voucherCode?.[0],
        },
        acquisition: acquisitionData,
      },
    });

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      errorCode: "VALIDATION_ERROR",
      suggestedStep:
        fieldErrors.serviceId || fieldErrors.slotId || fieldErrors.startsAt
          ? 2
          : fieldErrors.fullName || fieldErrors.email || fieldErrors.phone || fieldErrors.clientNote
            ? 3
            : fieldErrors.voucherCode
              ? 3
            : 4,
      fieldErrors: {
        serviceId: fieldErrors.serviceId?.[0],
        slotId: fieldErrors.slotId?.[0],
        startsAt: fieldErrors.startsAt?.[0],
        fullName: fieldErrors.fullName?.[0],
        email: fieldErrors.email?.[0],
        phone: fieldErrors.phone?.[0],
        clientNote: fieldErrors.clientNote?.[0],
        voucherCode: fieldErrors.voucherCode?.[0],
      },
    };
  }

  try {
    const result = await createPublicBooking({
      serviceId: parsed.data.serviceId,
      slotId: parsed.data.slotId,
      startsAt: parsed.data.startsAt,
      fullName: parsed.data.fullName,
      email: normalizeClientEmail(parsed.data.email),
      phone: normalizeClientPhone(parsed.data.phone || undefined),
      clientNote: parsed.data.clientNote || undefined,
      voucherCode: parsed.data.voucherCode || undefined,
      acquisition: acquisitionData,
    });

    await writeSubmissionLog({
      outcome: BookingSubmissionOutcome.SUCCESS,
      ipHash: submissionMetadata.ipHash,
      emailHash,
      userAgent: submissionMetadata.userAgent,
      bookingId: result.bookingId,
      serviceId: parsed.data.serviceId,
      slotId: parsed.data.slotId,
      metadata: {
        startsAt: parsed.data.startsAt,
        acquisition: acquisitionData,
      },
    });

    await releaseAtomicRateLimitReservation(emailRateLimit.reservationId);

    return {
      status: "success",
      confirmation: result,
    };
  } catch (error) {
    if (error instanceof PublicBookingError) {
      const publicFormError = getPublicFacingBookingErrorMessage(error);

      await writeSubmissionLog({
        outcome: BookingSubmissionOutcome.FAILED,
        ipHash: submissionMetadata.ipHash,
        emailHash,
        userAgent: submissionMetadata.userAgent,
        serviceId: parsed.success ? parsed.data.serviceId : undefined,
        slotId: parsed.success ? parsed.data.slotId : undefined,
        failureCode: error.code,
        failureReason: error.message,
        metadata: {
          suggestedStep: error.suggestedStep,
          field: error.code === publicBookingErrorCodes.voucherInvalid ? "voucherCode" : undefined,
          acquisition: acquisitionData,
        },
      });

      if (error.code === publicBookingErrorCodes.bookingConflict) {
        await releaseAtomicRateLimitReservation(emailRateLimit.reservationId);
      }

      if (
        error.code === publicBookingErrorCodes.bookingConflict
        || isSlotUnavailableDueToBookingConflict(error)
      ) {
        await sendOwnerSystemErrorPushover({
          title: "PP Studio - konflikt verejne rezervace",
          message: `Verejna rezervace vratila kod ${error.code}.`,
          context: {
            contextId: parsed.success ? parsed.data.slotId : "public-booking-conflict",
            slotId: parsed.success ? parsed.data.slotId : null,
            serviceId: parsed.success ? parsed.data.serviceId : null,
          },
          error,
        });
      }

      return {
        status: "error",
        formError: publicFormError,
        errorCode: error.code,
        suggestedStep: error.suggestedStep,
        availabilityErrorId:
          error.suggestedStep === 2
          && (
            error.code === publicBookingErrorCodes.bookingConflict
            || error.code === publicBookingErrorCodes.slotUnavailable
            || error.code === publicBookingErrorCodes.slotNotAllowed
            || error.code === publicBookingErrorCodes.slotTooShort
          )
            ? randomUUID()
            : undefined,
        fieldErrors:
          error.code === publicBookingErrorCodes.voucherInvalid && publicFormError
            ? { voucherCode: publicFormError }
            : undefined,
      };
    }

    if (isBookingSchemaDriftError(error)) {
      console.error("Public booking action failed due to schema drift", error);

      await sendOwnerSystemErrorPushover({
        title: "PP Studio - systemova chyba",
        message: "Verejne vytvoreni rezervace narazilo na schema drift nebo chybejici migraci.",
        context: {
          contextId: "public-booking-schema-drift",
          slotId: parsed.success ? parsed.data.slotId : null,
        },
        error,
      });

      await writeSubmissionLog({
        outcome: BookingSubmissionOutcome.FAILED,
        ipHash: submissionMetadata.ipHash,
        emailHash,
        userAgent: submissionMetadata.userAgent,
        serviceId: parsed.success ? parsed.data.serviceId : undefined,
        slotId: parsed.success ? parsed.data.slotId : undefined,
        failureCode: "SCHEMA_MISMATCH",
        failureReason: "Databáze nemá aplikované migrace pro nové booking action tokeny.",
        metadata: {
          acquisition: acquisitionData,
        },
      });

      return {
        status: "error",
        formError:
          "Rezervaci se teď nepodařilo dokončit. Zkuste to prosím znovu později nebo kontaktujte studio.",
        errorCode: "UNEXPECTED_ERROR",
        suggestedStep: 4,
      };
    }

    console.error("Public booking action failed", error);

    await sendOwnerSystemErrorPushover({
      title: "PP Studio - systemova chyba",
      message: "Verejne vytvoreni rezervace skoncilo neocekavanou chybou.",
      context: {
        contextId: submissionMetadata.ipHash ?? parsed.data.slotId,
      },
      error,
    });

    await writeSubmissionLog({
      outcome: BookingSubmissionOutcome.FAILED,
      ipHash: submissionMetadata.ipHash,
      emailHash,
      userAgent: submissionMetadata.userAgent,
      serviceId: parsed.success ? parsed.data.serviceId : undefined,
      slotId: parsed.success ? parsed.data.slotId : undefined,
      failureCode: "UNEXPECTED_ERROR",
      failureReason: "Rezervaci se teď nepodařilo potvrdit. Zkuste to prosím znovu za chvíli.",
      metadata: {
        acquisition: acquisitionData,
      },
    });

    return {
      status: "error",
      formError: "Rezervaci se teď nepodařilo potvrdit. Zkuste to prosím znovu za chvíli.",
      errorCode: "UNEXPECTED_ERROR",
      suggestedStep: 4,
    };
  }
}
