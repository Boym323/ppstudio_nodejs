export type UpdateVoucherSettingsActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"voucherDefaultTemplateKey" | "voucherDefaultValidityMonths", string>>;
};

export const initialUpdateVoucherSettingsActionState: UpdateVoucherSettingsActionState = {
  status: "idle",
};
