"use client";

import { BookingStatus } from "@/generated/prisma/browser";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
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
  onSuccess?: (message: string) => void;
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
  onSuccess,
  availableActions,
}: AdminBookingsQuickActionsProps) {
  const [serverState, formAction] = useActionState(
    updateBookingStatusAction,
    initialUpdateBookingStatusActionState,
  );
  const lastSubmittedAction = useRef<string | null>(null);
  const previousServerState = useRef(serverState);

  const quickActions = getQuickActions(status, availableActions);

  useEffect(() => {
    if (previousServerState.current !== serverState && serverState.status === "success" && onSuccess) {
      onSuccess(resolveToastMessage(lastSubmittedAction.current));
    }
    previousServerState.current = serverState;
  }, [onSuccess, serverState]);

  return (
    <div className="space-y-1">
      <form
        action={formAction}
        className="grid w-full grid-cols-2 items-stretch gap-2 sm:flex sm:flex-wrap sm:gap-1 md:flex-nowrap md:justify-end"
        onClick={(event) => event.stopPropagation()}
      >
        <input type="hidden" name="area" value={area} />
        <input type="hidden" name="bookingId" value={bookingId} />

        {quickActions.map((action) => (
          <QuickSubmitButton
            key={action.value}
            value={action.value}
            kind={action.value}
            onBeforeSubmit={() => {
              lastSubmittedAction.current = action.value;
            }}
          >
            Potvrdit
          </QuickSubmitButton>
        ))}

        <Link
          href={href}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-full border border-white/12 px-3 py-2 text-sm font-medium text-white/72 transition hover:border-white/24 hover:bg-white/7 hover:text-white sm:min-h-8 sm:min-w-[6rem] sm:py-1 sm:text-[11px]"
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
  onBeforeSubmit,
  children,
}: {
  value: string;
  kind: string;
  onBeforeSubmit: () => void;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="targetStatus"
      value={value}
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        onBeforeSubmit();
      }}
      className={cn(
        "inline-flex min-h-11 min-w-0 items-center justify-center rounded-full border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-8 sm:min-w-[6rem] sm:py-1 sm:text-[11px]",
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
      return ["CONFIRMED"]
        .map((value) => actionByValue.get(value))
        .filter((action): action is NonNullable<(typeof availableActions)[number]> => Boolean(action));
    default:
      return [];
  }
}

function resolveToastMessage(action: string | null) {
  switch (action) {
    case "CONFIRMED":
      return "Rezervace potvrzena";
    case "CANCELLED":
      return "Rezervace zrušena";
    default:
      return "Změna rezervace byla uložena";
  }
}
