export type AdminUserAccessActionState = {
  status: "idle" | "success" | "error";
  formError?: string;
  successMessage?: string;
  fieldErrors?: {
    name?: string;
    email?: string;
    role?: string;
  };
};

export const initialAdminUserAccessActionState: AdminUserAccessActionState = {
  status: "idle",
};
