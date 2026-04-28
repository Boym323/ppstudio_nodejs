export type PublicBookingActionState = {
  status: "idle" | "error" | "success";
  formError?: string;
  errorCode?: string;
  suggestedStep?: 1 | 2 | 3 | 4;
  fieldErrors?: Partial<Record<"serviceId" | "slotId" | "startsAt" | "fullName" | "email" | "phone" | "clientNote" | "voucherCode", string>>;
  confirmation?: {
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
};

export const initialPublicBookingActionState: PublicBookingActionState = {
  status: "idle",
};
