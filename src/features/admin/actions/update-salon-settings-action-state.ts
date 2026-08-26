export type UpdateSalonSettingsActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<
    Record<
      | "salonName"
      | "addressLine"
      | "city"
      | "postalCode"
      | "phone"
      | "contactEmail"
      | "instagramUrl"
      | "voucherPdfLogoMediaId"
      | "contactPhotoMediaId"
      | "homePortraitMediaId"
      | "aboutPortraitMediaId",
      string
    >
  >;
};

export const initialUpdateSalonSettingsActionState: UpdateSalonSettingsActionState = {
  status: "idle",
};
