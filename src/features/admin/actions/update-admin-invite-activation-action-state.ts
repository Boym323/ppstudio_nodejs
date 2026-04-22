export type AdminInviteActivationActionState = {
  status: "idle" | "success" | "error";
  formError?: string;
  successMessage?: string;
  fieldErrors?: Partial<Record<"password" | "confirmPassword", string>>;
};

export const initialAdminInviteActivationActionState: AdminInviteActivationActionState = {
  status: "idle",
};
