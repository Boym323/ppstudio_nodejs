"use server";

import { BookingSubmissionOutcome, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { z } from "zod";

import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import {
  BOOKING_ACQUISITION_COOKIE,
  parseBookingAcquisitionCookie,
} from "@/features/booking/lib/booking-acquisition";
import {
  createPublicBooking,
  isValidNormalizedClientPhone,
  normalizeClientEmail,
  normalizeClientPhone,
  PublicBookingError,
  publicBookingErrorCodes,
} from "@/features/booking/lib/booking-public";
import { type PublicBookingActionState } from "@/features/booking/actions/public-booking-action-state";
import { sendOwnerPushover } from "@/lib/notifications/pushover";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

const BOOKING_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP = 8;
const MAX_FAILED_ATTEMPTS_PER_EMAIL = 3;

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
    .refine((value) => value.length === 0 || isValidNormalizedClientPhone(normalizeClientPhone(value)), {
      message: "Telefon zadejte s 8 až 15 číslicemi, případně s úvodním +.",
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

function extractClientIp(requestHeaders: Headers) {
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  if (forwardedFor) {
    const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
    if (firstForwardedIp) {
      return firstForwardedIp;
    }
  }

  return (
    requestHeaders.get("cf-connecting-ip") ??
    requestHeaders.get("x-real-ip") ??
    requestHeaders.get("x-vercel-forwarded-for") ??
    undefined
  );
}

function getSubmissionMetadata(requestHeaders: Headers) {
  const clientIp = extractClientIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 256) ?? undefined;

  return {
    ipHash: clientIp ? hashSubmissionFingerprint(clientIp) : undefined,
    userAgent,
  };
}

async function getRecentSubmissionCounts(ipHash?: string, emailHash?: string) {
  const windowStart = new Date(Date.now() - BOOKING_ATTEMPT_WINDOW_MS);

  const [ipAttempts, emailFailures] = await Promise.all([
    ipHash
      ? prisma.bookingSubmissionLog.count({
          where: {
            ipHash,
            createdAt: {
              gte: windowStart,
            },
            outcome: {
              in: [
                BookingSubmissionOutcome.SUCCESS,
                BookingSubmissionOutcome.FAILED,
                BookingSubmissionOutcome.BLOCKED,
              ],
            },
          },
        })
      : Promise.resolve(0),
    emailHash
      ? prisma.bookingSubmissionLog.count({
          where: {
            emailHash,
            createdAt: {
              gte: windowStart,
            },
            outcome: {
              in: [BookingSubmissionOutcome.FAILED, BookingSubmissionOutcome.BLOCKED],
            },
          },
        })
      : Promise.resolve(0),
  ]);

  return { ipAttempts, emailFailures };
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

  const { ipAttempts, emailFailures } = await getRecentSubmissionCounts(
    submissionMetadata.ipHash,
    emailHash,
  );

  if (ipAttempts >= MAX_ATTEMPTS_PER_IP || emailFailures >= MAX_FAILED_ATTEMPTS_PER_EMAIL) {
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

    return {
      status: "success",
      confirmation: result,
    };
  } catch (error) {
    if (error instanceof PublicBookingError) {
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

      return {
        status: "error",
        formError: error.message,
        errorCode: error.code,
        suggestedStep: error.suggestedStep,
        fieldErrors:
          error.code === publicBookingErrorCodes.voucherInvalid
            ? { voucherCode: error.message }
            : undefined,
      };
    }

    if (isBookingSchemaDriftError(error)) {
      console.error("Public booking action failed due to schema drift", error);

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
        formError: "Rezervaci teď nelze dokončit kvůli neaplikované databázové migraci. Aplikujte prosím poslední migrace a zkuste to znovu.",
        errorCode: "UNEXPECTED_ERROR",
        suggestedStep: 4,
      };
    }

    console.error("Public booking action failed", error);

    await sendOwnerPushover({
      type: "SYSTEM_ERROR",
      title: "PP Studio - systemova chyba",
      message: "Verejne vytvoreni rezervace skoncilo neocekavanou chybou.",
      priority: 1,
      context: {
        contextId: submissionMetadata.ipHash ?? parsed.data.slotId,
      },
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
