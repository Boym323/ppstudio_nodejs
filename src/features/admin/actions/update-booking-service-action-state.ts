export type UpdateBookingServiceActionState = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
  fieldErrors?: Partial<Record<"serviceId" | "reason", string>>;
};

export const initialUpdateBookingServiceActionState: UpdateBookingServiceActionState = {
  status: "idle",
};


export type BookingServiceChangePreview =
  | { status: "blocked"; message: string }
  | {
      status: "ready" | "requires-override";
      message: string;
      serviceEndsAt: string;
      blockedUntil: string;
      cleanupBlockMinutes: number;
    };
