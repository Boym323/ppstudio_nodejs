export type UpdateBookingServiceActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"serviceId" | "reason", string>>;
};

export const initialUpdateBookingServiceActionState: UpdateBookingServiceActionState = {
  status: "idle",
};
