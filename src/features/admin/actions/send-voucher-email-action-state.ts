export type SendVoucherEmailActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"recipientEmail" | "subject" | "voucherId", string>>;
};

export const initialSendVoucherEmailActionState: SendVoucherEmailActionState = {
  status: "idle",
};
