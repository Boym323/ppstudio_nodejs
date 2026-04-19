export type UpdateServiceActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<
    Record<
      | "name"
      | "shortDescription"
      | "description"
      | "durationMinutes"
      | "priceFromCzk"
      | "categoryId"
      | "sortOrder",
      string
    >
  >;
};

export const initialUpdateServiceActionState: UpdateServiceActionState = {
  status: "idle",
};
