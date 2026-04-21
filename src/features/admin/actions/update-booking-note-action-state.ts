export type UpdateBookingNoteActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"internalNote", string>>;
};

export const initialUpdateBookingNoteActionState: UpdateBookingNoteActionState = {
  status: "idle",
};
