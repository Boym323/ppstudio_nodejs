export type UpdateEmailSettingsActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<
    Record<
      | "notificationAdminEmail"
      | "emailSenderName"
      | "emailSenderEmail"
      | "emailFooterText",
      string
    >
  >;
};

export const initialUpdateEmailSettingsActionState: UpdateEmailSettingsActionState = {
  status: "idle",
};
