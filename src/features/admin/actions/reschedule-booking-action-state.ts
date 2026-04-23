export type RescheduleBookingActionState = {
  status: "idle" | "success" | "error";
  formError?: string;
  successMessage?: string;
  warningMessage?: string;
  fieldErrors?: Partial<Record<"slotId" | "manualDate" | "manualTime" | "reason", string>>;
};

export const initialRescheduleBookingActionState: RescheduleBookingActionState = {
  status: "idle",
};
