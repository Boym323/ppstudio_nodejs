export type RedeemBookingVoucherActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"voucherCode" | "amountCzk" | "note", string>>;
};

export const initialRedeemBookingVoucherActionState: RedeemBookingVoucherActionState = {
  status: "idle",
};
