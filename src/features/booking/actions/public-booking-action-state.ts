export type PublicBookingActionState = {
  status: "idle" | "error" | "success";
  formError?: string;
  errorCode?: string;
  suggestedStep?: 1 | 2 | 3 | 4;
  fieldErrors?: Partial<Record<"serviceId" | "slotId" | "startsAt" | "fullName" | "email" | "phone" | "clientNote", string>>;
  confirmation?: {
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
};

export const initialPublicBookingActionState: PublicBookingActionState = {
  status: "idle",
};
