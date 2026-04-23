export type UpdateServiceActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<
    Record<
      | "name"
      | "description"
      | "publicIntro"
      | "seoDescription"
      | "pricingShortDescription"
      | "pricingBadge"
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
