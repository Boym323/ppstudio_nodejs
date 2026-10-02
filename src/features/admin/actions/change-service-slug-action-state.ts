export type ChangeServiceSlugActionState = {
  status: "idle" | "success" | "error";
  formError?: string;
};

export const initialChangeServiceSlugActionState: ChangeServiceSlugActionState = { status: "idle" };
