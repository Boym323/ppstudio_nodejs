export type UpdateServiceCategoryActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  category?: {
    id: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  };
  fieldErrors?: Partial<Record<"name" | "description" | "sortOrder", string>>;
};

export const initialUpdateServiceCategoryActionState: UpdateServiceCategoryActionState = {
  status: "idle",
};
