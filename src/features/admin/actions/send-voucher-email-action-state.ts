export type SendVoucherEmailActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"recipientEmail" | "subject" | "message" | "voucherId", string>>;
};

export const initialSendVoucherEmailActionState: SendVoucherEmailActionState = {
  status: "idle",
};
