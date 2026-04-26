export type UpdatePushoverSettingsActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<
    Record<
      | "pushoverUserKey"
      | "pushoverEnabled"
      | "notifyNewBooking"
      | "notifyBookingPending"
      | "notifyBookingConfirmed"
      | "notifyBookingCancelled"
      | "notifyBookingRescheduled"
      | "notifyEmailFailed"
      | "notifyReminderFailed"
      | "notifySystemErrors",
      string
    >
  >;
};

export const initialUpdatePushoverSettingsActionState: UpdatePushoverSettingsActionState = {
  status: "idle",
};

export type TestPushoverActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
};

export const initialTestPushoverActionState: TestPushoverActionState = {
  status: "idle",
};
