export type UpdateBookingStatusActionState = {
  status: "idle" | "error" | "success";
  formError?: string;
  successMessage?: string;
  fieldErrors?: Partial<Record<"targetStatus" | "reason", string>>;
};

export const initialUpdateBookingStatusActionState: UpdateBookingStatusActionState = {
  status: "idle",
};
