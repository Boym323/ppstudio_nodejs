"use client";

import { BookingStatus } from "@prisma/client";
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
  status: BookingStatus;
  availableActions: Array<{
    value: string;
    label: string;
  }>;
};

export function AdminBookingsQuickActions({
  area,
  bookingId,
  href,
  status,
  availableActions,
}: AdminBookingsQuickActionsProps) {
  const [serverState, formAction] = useActionState(
    updateBookingStatusAction,
    initialUpdateBookingStatusActionState,
  );

  const quickActions = getQuickActions(status, availableActions);

  return (
    <div className="space-y-1">
      <form
        action={formAction}
        className="flex w-full flex-wrap items-stretch justify-start gap-1"
      >
        <input type="hidden" name="area" value={area} />
        <input type="hidden" name="bookingId" value={bookingId} />

        {quickActions.map((action) => (
          <QuickSubmitButton key={action.value} value={action.value} kind={action.value}>
            {action.value === "CONFIRMED" ? "Potvrdit" : "Zrušit"}
          </QuickSubmitButton>
        ))}

        <Link
          href={href}
          className="inline-flex min-h-8 min-w-[5.5rem] items-center justify-center rounded-full border border-white/12 px-3 py-1 text-[11px] font-medium text-white/72 transition hover:border-white/24 hover:bg-white/7 hover:text-white"
        >
          Otevřít
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
  kind,
  children,
}: {
  value: string;
  kind: string;
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
        "inline-flex min-h-8 min-w-[5.5rem] items-center justify-center rounded-full border px-3 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
        kind === "CONFIRMED"
          ? "border-amber-300/55 bg-amber-400/18 text-amber-50 hover:bg-amber-400/26"
          : "border-white/12 bg-white/5 text-white/74 hover:border-red-300/35 hover:bg-red-400/12 hover:text-red-50",
      )}
    >
      {pending ? "Ukládám..." : children}
    </button>
  );
}

function getQuickActions(
  status: BookingStatus,
  availableActions: Array<{
    value: string;
    label: string;
  }>,
) {
  const actionByValue = new Map(availableActions.map((action) => [action.value, action]));

  switch (status) {
    case BookingStatus.PENDING:
      return ["CONFIRMED", "CANCELLED"]
        .map((value) => actionByValue.get(value))
        .filter((action): action is NonNullable<(typeof availableActions)[number]> => Boolean(action));
    case BookingStatus.CONFIRMED:
      return ["CANCELLED"]
        .map((value) => actionByValue.get(value))
        .filter((action): action is NonNullable<(typeof availableActions)[number]> => Boolean(action));
    default:
      return [];
  }
}
