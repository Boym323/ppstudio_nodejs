export type UpdateClientNoteActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"internalNote", string>>;
};

export const initialUpdateClientNoteActionState: UpdateClientNoteActionState = {
  status: "idle",
};
