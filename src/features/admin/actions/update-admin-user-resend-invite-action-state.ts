export type AdminUserResendInviteActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialAdminUserResendInviteActionState: AdminUserResendInviteActionState = {
  status: "idle",
};
