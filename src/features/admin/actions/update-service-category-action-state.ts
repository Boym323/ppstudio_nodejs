export type UpdateServiceCategoryActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  category?: {
    id: string;
    name: string;
    publicName: string | null;
    description: string | null;
    pricingDescription: string | null;
    pricingLayout: "LIST" | "GRID";
    pricingIconKey: "DROPLET" | "EYE_LASHES" | "LOTUS" | "BRUSH" | "LEAF" | "LIPSTICK" | "SPARK";
    sortOrder: number;
    pricingSortOrder: number;
    isActive: boolean;
  };
  fieldErrors?: Partial<
    Record<
      "name" | "publicName" | "description" | "pricingDescription" | "pricingLayout" | "pricingIconKey" | "sortOrder" | "pricingSortOrder",
      string
    >
  >;
};

export const initialUpdateServiceCategoryActionState: UpdateServiceCategoryActionState = {
  status: "idle",
};
