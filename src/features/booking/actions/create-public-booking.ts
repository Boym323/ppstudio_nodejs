"use server";

import { z } from "zod";

import {
  createPublicBooking,
  normalizeClientEmail,
  normalizeClientPhone,
  PublicBookingError,
} from "@/features/booking/lib/booking-public";

const publicBookingSchema = z.object({
  serviceId: z.string().min(1, "Vyberte službu."),
  slotId: z.string().min(1, "Vyberte termín."),
  fullName: z.string().trim().min(2, "Zadejte jméno a příjmení."),
  email: z.email("Zadejte platný e-mail."),
  phone: z
    .string()
    .trim()
    .max(32, "Telefon je příliš dlouhý.")
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
    serviceId: formData.get("serviceId"),
    slotId: formData.get("slotId"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    clientNote: formData.get("clientNote"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
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
      };
    }

    console.error("Public booking action failed", error);

    return {
      status: "error",
      formError: "Rezervaci se teď nepodařilo potvrdit. Zkuste to prosím znovu za chvíli.",
    };
  }
}
