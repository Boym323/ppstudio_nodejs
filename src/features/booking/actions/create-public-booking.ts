"use server";

import { z } from "zod";

import {
  createPublicBooking,
  isValidNormalizedClientPhone,
  normalizeClientEmail,
  normalizeClientPhone,
  PublicBookingError,
} from "@/features/booking/lib/booking-public";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

const publicBookingSchema = z.object({
  serviceId: z.string().trim().min(1, "Vyberte službu.").max(64, "Vyberte službu z nabídky."),
  slotId: z.string().trim().min(1, "Vyberte termín.").max(64, "Vyberte termín z nabídky."),
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
});

export type PublicBookingActionState = {
  status: "idle" | "error" | "success";
  formError?: string;
  errorCode?: string;
  suggestedStep?: 1 | 2 | 3 | 4;
  fieldErrors?: Partial<Record<"serviceId" | "slotId" | "fullName" | "email" | "phone" | "clientNote", string>>;
  confirmation?: {
    bookingId: string;
    referenceCode: string;
    serviceName: string;
    scheduledAtLabel: string;
    clientName: string;
    clientEmail: string;
  };
};

export const initialPublicBookingActionState: PublicBookingActionState = {
  status: "idle",
};

export async function createPublicBookingAction(
  _previousState: PublicBookingActionState,
  formData: FormData,
): Promise<PublicBookingActionState> {
  const parsed = publicBookingSchema.safeParse({
    serviceId: readFormString(formData, "serviceId"),
    slotId: readFormString(formData, "slotId"),
    fullName: readFormString(formData, "fullName"),
    email: readFormString(formData, "email"),
    phone: readFormString(formData, "phone"),
    clientNote: readFormString(formData, "clientNote"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      errorCode: "VALIDATION_ERROR",
      suggestedStep:
        fieldErrors.serviceId || fieldErrors.slotId
          ? 2
          : fieldErrors.fullName || fieldErrors.email || fieldErrors.phone || fieldErrors.clientNote
            ? 3
            : 4,
      fieldErrors: {
        serviceId: fieldErrors.serviceId?.[0],
        slotId: fieldErrors.slotId?.[0],
        fullName: fieldErrors.fullName?.[0],
        email: fieldErrors.email?.[0],
        phone: fieldErrors.phone?.[0],
        clientNote: fieldErrors.clientNote?.[0],
      },
    };
  }

  try {
    const result = await createPublicBooking({
      serviceId: parsed.data.serviceId,
      slotId: parsed.data.slotId,
      fullName: parsed.data.fullName,
      email: normalizeClientEmail(parsed.data.email),
      phone: normalizeClientPhone(parsed.data.phone || undefined),
      clientNote: parsed.data.clientNote || undefined,
    });

    return {
      status: "success",
      confirmation: result,
    };
  } catch (error) {
    if (error instanceof PublicBookingError) {
      return {
        status: "error",
        formError: error.message,
        errorCode: error.code,
        suggestedStep: error.suggestedStep,
      };
    }

    console.error("Public booking action failed", error);

    return {
      status: "error",
      formError: "Rezervaci se teď nepodařilo potvrdit. Zkuste to prosím znovu za chvíli.",
      errorCode: "UNEXPECTED_ERROR",
      suggestedStep: 4,
    };
  }
}
