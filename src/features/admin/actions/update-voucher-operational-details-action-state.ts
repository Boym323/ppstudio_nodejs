export type UpdateVoucherOperationalDetailsActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"purchaserName" | "purchaserEmail" | "validUntil" | "internalNote", string>>;
};

export const initialUpdateVoucherOperationalDetailsActionState: UpdateVoucherOperationalDetailsActionState = {
  status: "idle",
};
