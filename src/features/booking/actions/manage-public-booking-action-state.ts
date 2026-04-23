export type ManagePublicBookingActionState = {
  status: "idle" | "success" | "error";
  formError?: string;
  fieldErrors?: Partial<Record<"slotId", string>>;
  result?: {
    bookingId: string;
    serviceName: string;
    clientName: string;
    previousScheduledAtLabel: string;
    scheduledAtLabel: string;
    notificationStatus: "queued" | "logged" | "skipped" | "failed";
  };
};

export const initialManagePublicBookingActionState: ManagePublicBookingActionState = {
  status: "idle",
};
