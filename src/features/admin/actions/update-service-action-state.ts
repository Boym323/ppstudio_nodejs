export type UpdateServiceActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<
    Record<
      | "name"
      | "publicName"
      | "description"
      | "publicIntro"
      | "seoTitle"
      | "seoDescription"
      | "idealFor"
      | "includes"
      | "benefits"
      | "goodToKnow"
      | "pricingShortDescription"
      | "pricingBadge"
      | "durationMinutes"
      | "cleanupMinutes"
      | "priceFromCzk"
      | "categoryId"
      | "sortOrder"
      | "homepageSortOrder",
      string
    >
  >;
};

export const initialUpdateServiceActionState: UpdateServiceActionState = {
  status: "idle",
};
