export type UpdateCalendarFeedActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
};

export const initialUpdateCalendarFeedActionState: UpdateCalendarFeedActionState = {
  status: "idle",
};
