export type ManagePublicBookingActionState = {
  status: "idle" | "success" | "error";
  formError?: string;
  errorCode?: string;
  /** Jedinečný identifikátor konkrétní odpovědi o nedostupném termínu. */
  availabilityErrorId?: string;
  fieldErrors?: Partial<Record<"slotId", string>>;
  result?: {
    bookingId: string;
    serviceName: string;
    clientName: string;
    previousScheduledAtLabel: string;
    scheduledAtLabel: string;
    notificationStatus: "queued" | "logged" | "skipped";
  };
};

export const initialManagePublicBookingActionState: ManagePublicBookingActionState = {
  status: "idle",
};
