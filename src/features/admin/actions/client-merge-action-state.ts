import { type ClientMergePreview } from "@/features/admin/lib/client-merge-preview";

export type ClientMergeActionState = {
  status: "idle" | "preview" | "success" | "error";
  preview?: ClientMergePreview;
  previewToken?: string;
  successMessage?: string;
  targetHref?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"targetEmail" | "confirmSourceEmail" | "confirmEffects" | "nameChoice" | "phoneChoice", string>>;
};

export const initialClientMergeActionState: ClientMergeActionState = {
  status: "idle",
};
