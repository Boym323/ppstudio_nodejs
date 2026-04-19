export type UpdateServiceCategoryActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"name" | "description" | "sortOrder", string>>;
};

export const initialUpdateServiceCategoryActionState: UpdateServiceCategoryActionState = {
  status: "idle",
};
