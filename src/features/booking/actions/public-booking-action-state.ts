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
    emailDeliveryStatus: "queued" | "logged" | "skipped";
  };
};

export const initialPublicBookingActionState: PublicBookingActionState = {
  status: "idle",
};
