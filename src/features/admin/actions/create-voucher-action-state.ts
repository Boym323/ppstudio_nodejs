export type CreateVoucherActionState = {
  status: "idle" | "error";
  formError?: string;
  fieldErrors?: Partial<
    Record<
      | "type"
      | "originalValueCzk"
      | "serviceId"
      | "validFrom"
      | "validUntil"
      | "purchaserName"
      | "purchaserEmail"
      | "internalNote",
      string
    >
  >;
};

export const initialCreateVoucherActionState: CreateVoucherActionState = {
  status: "idle",
};
