export type UpdateClientContactActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"email" | "phone", string>>;
};

export const initialUpdateClientContactActionState: UpdateClientContactActionState = {
  status: "idle",
};
