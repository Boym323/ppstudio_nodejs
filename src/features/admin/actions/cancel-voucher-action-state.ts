export type CancelVoucherActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"cancelReason", string>>;
};

export const initialCancelVoucherActionState: CancelVoucherActionState = {
  status: "idle",
};
