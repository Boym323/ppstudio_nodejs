export type UpdateBookingSettingsActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<
    Record<
      "bookingMinAdvanceHours" | "bookingMaxAdvanceDays" | "bookingCancellationHours" | "autoLunchEnabled",
      string
    >
  >;
};

export const initialUpdateBookingSettingsActionState: UpdateBookingSettingsActionState = {
  status: "idle",
};
