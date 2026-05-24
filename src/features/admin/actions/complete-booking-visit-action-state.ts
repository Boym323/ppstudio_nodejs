export type CompleteBookingVisitActionState = {
  status: "idle" | "error" | "success";
  formError?: string;
  successMessage?: string;
  fieldErrors?: Partial<
    Record<
      | "completionMode"
      | "reason"
      | "voucherCode"
      | "voucherAmountCzk"
      | "directAmountCzk"
      | "directMethod",
      string
    >
  >;
};

export const initialCompleteBookingVisitActionState: CompleteBookingVisitActionState = {
  status: "idle",
};
