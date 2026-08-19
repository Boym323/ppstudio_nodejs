export type CreateBookingPaymentActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"amountCzk" | "method" | "paidAt" | "note", string>>;
  similarPayment?: { id: string; amountCzk: number; methodLabel: string; minutesAgo: number };
};

export type UpdateBookingPaymentActionState = Omit<CreateBookingPaymentActionState, "similarPayment">;

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

export const initialUpdateBookingPaymentActionState: UpdateBookingPaymentActionState = {
  status: "idle",
};
