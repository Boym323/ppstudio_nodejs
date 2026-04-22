export type CreateManualBookingActionState = {
  status: "idle" | "success" | "error";
  formError?: string;
  successMessage?: string;
  createdBookingId?: string;
  manualOverrideWarning?: string;
  fieldErrors?: Partial<
    Record<
      | "client"
      | "serviceId"
      | "slotId"
      | "manualDate"
      | "manualTime"
      | "fullName"
      | "email"
      | "phone"
      | "source"
      | "bookingStatus",
      string
    >
  >;
};

export const initialCreateManualBookingActionState: CreateManualBookingActionState = {
  status: "idle",
};
