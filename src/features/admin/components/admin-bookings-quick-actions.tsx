"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { type AdminArea } from "@/config/navigation";
import { updateBookingStatusAction } from "@/features/admin/actions/booking-actions";
import { initialUpdateBookingStatusActionState } from "@/features/admin/actions/update-booking-status-action-state";
import { cn } from "@/lib/utils";

type AdminBookingsQuickActionsProps = {
  area: AdminArea;
  bookingId: string;
  href: string;
  availableActions: Array<{
    value: string;
    label: string;
  }>;
};

const quickActionOrder = ["CONFIRMED", "CANCELLED"] as const;

export function AdminBookingsQuickActions({
  area,
  bookingId,
  href,
  availableActions,
}: AdminBookingsQuickActionsProps) {
  const [serverState, formAction] = useActionState(
    updateBookingStatusAction,
    initialUpdateBookingStatusActionState,
  );

  const quickActions = quickActionOrder
    .map((value) => availableActions.find((action) => action.value === value))
    .filter((action): action is NonNullable<(typeof availableActions)[number]> => Boolean(action));

  return (
    <div className="space-y-1">
      <form
        action={formAction}
        className="flex w-full flex-wrap items-center justify-end gap-1 rounded-full border border-white/8 bg-white/[0.03] p-1 lg:w-fit lg:gap-0.5 lg:p-0.5"
      >
        <input type="hidden" name="area" value={area} />
        <input type="hidden" name="bookingId" value={bookingId} />

        {quickActions.map((action) => (
          <QuickSubmitButton key={action.value} value={action.value}>
            {action.value === "CONFIRMED" ? "Potvrdit" : "Zrušit"}
          </QuickSubmitButton>
        ))}

        <Link
          href={href}
          className="inline-flex shrink-0 min-h-8 items-center rounded-full border border-white/12 px-3 py-1 text-[11px] font-medium text-white/72 transition hover:border-white/24 hover:bg-white/7 hover:text-white lg:min-h-7 lg:px-2 lg:py-0.5 lg:text-[10px]"
        >
          Detail
        </Link>
      </form>

      {serverState.status === "error" && serverState.formError ? (
        <p className="text-right text-[11px] leading-4 text-red-300">{serverState.formError}</p>
      ) : null}
    </div>
  );
}

function QuickSubmitButton({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="targetStatus"
      value={value}
      disabled={pending}
      className={cn(
        "inline-flex shrink-0 min-h-8 items-center rounded-full border px-3 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-7 lg:px-2 lg:py-0.5 lg:text-[10px]",
        value === "CONFIRMED"
          ? "border-amber-300/45 bg-amber-400/12 text-amber-100 hover:bg-amber-400/18"
          : "border-red-300/35 bg-red-400/10 text-red-100 hover:bg-red-400/16",
      )}
    >
      {pending ? "Ukládám..." : children}
    </button>
  );
}
