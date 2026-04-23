export type CancelPublicBookingActionState = {
  status: "idle" | "success" | "error";
  formError?: string;
  result?: {
    serviceName: string;
    clientName: string;
    scheduledAtLabel: string;
    emailDeliveryStatus: "queued" | "logged" | "skipped";
  };
};

export const initialCancelPublicBookingActionState: CancelPublicBookingActionState = {
  status: "idle",
};
