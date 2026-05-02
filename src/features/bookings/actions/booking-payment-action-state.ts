export type CreateBookingPaymentActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"amountCzk" | "method" | "paidAt" | "note", string>>;
};

export type DeleteBookingPaymentActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
};

export const initialCreateBookingPaymentActionState: CreateBookingPaymentActionState = {
  status: "idle",
};

export const initialDeleteBookingPaymentActionState: DeleteBookingPaymentActionState = {
  status: "idle",
};
