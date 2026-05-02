"use client";

import { BookingPaymentMethod } from "@prisma/client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  createBookingPaymentAction,
  deleteBookingPaymentAction,
} from "@/features/bookings/actions/booking-payment-actions";
import {
  initialCreateBookingPaymentActionState,
  initialDeleteBookingPaymentActionState,
} from "@/features/bookings/actions/booking-payment-action-state";
import { BOOKING_PAYMENT_METHOD_LABELS } from "@/features/bookings/lib/booking-payment-summary";
import { type AdminBookingDetailData } from "@/features/admin/lib/admin-booking";

type AdminBookingPaymentFormProps = {
  area: AdminBookingDetailData["area"];
  bookingId: string;
  defaultAmountCzk: number;
};

type DeleteBookingPaymentButtonProps = {
  area: AdminBookingDetailData["area"];
  bookingId: string;
  paymentId: string;
};

const paymentMethods = [
  BookingPaymentMethod.CASH,
  BookingPaymentMethod.BANK_TRANSFER,
  BookingPaymentMethod.OTHER,
] as const;

export function AdminBookingPaymentForm({
  area,
  bookingId,
  defaultAmountCzk,
}: AdminBookingPaymentFormProps) {
  const [serverState, formAction] = useActionState(
    createBookingPaymentAction,
    initialCreateBookingPaymentActionState,
  );

  return (
    <details
      className="group rounded-[0.95rem] border border-white/8 bg-white/[0.03]"
    >
      <summary className="cursor-pointer list-none px-3.5 py-3 marker:hidden">
        <span className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition group-open:hidden hover:brightness-105">
          + Zapsat platbu
        </span>
        <span className="hidden text-sm font-medium text-white/78 group-open:inline">
          Zapsat platbu mimo voucher
        </span>
      </summary>

      <form action={formAction} className="space-y-3 border-t border-white/8 px-3.5 py-3">
        <input type="hidden" name="area" value={area} />
        <input type="hidden" name="bookingId" value={bookingId} />

        {serverState.status === "success" && serverState.successMessage ? (
          <div className="rounded-[0.9rem] border border-emerald-300/16 bg-emerald-400/10 px-3 py-2 text-sm leading-5 text-emerald-50">
            {serverState.successMessage}
          </div>
        ) : null}

        {serverState.status === "error" && serverState.formError ? (
          <div className="rounded-[0.9rem] border border-red-300/16 bg-red-400/10 px-3 py-2 text-sm leading-5 text-red-50">
            {serverState.formError}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-white">Částka</span>
            <input
              type="number"
              name="amountCzk"
              min={1}
              step={1}
              inputMode="numeric"
              defaultValue={defaultAmountCzk > 0 ? defaultAmountCzk : undefined}
              placeholder="Např. 500"
              className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
            />
            {serverState.fieldErrors?.amountCzk ? (
              <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.amountCzk}</p>
            ) : null}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white">Metoda platby</span>
            <select
              name="method"
              defaultValue={BookingPaymentMethod.CASH}
              className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/55"
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method} className="bg-neutral-950 text-white">
                  {BOOKING_PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>
            {serverState.fieldErrors?.method ? (
              <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.method}</p>
            ) : null}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white">Datum platby</span>
            <input
              type="datetime-local"
              name="paidAt"
              defaultValue={formatDateTimeLocalValue(new Date())}
              className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/55"
            />
            {serverState.fieldErrors?.paidAt ? (
              <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.paidAt}</p>
            ) : null}
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-white">Poznámka</span>
          <textarea
            name="note"
            rows={2}
            maxLength={500}
            placeholder="Např. doplatek po službě."
            className="mt-1.5 w-full resize-y rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm leading-5 text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
          />
          {serverState.fieldErrors?.note ? (
            <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.note}</p>
          ) : null}
        </label>

        <SubmitPaymentButton />
      </form>
    </details>
  );
}

export function DeleteBookingPaymentButton({
  area,
  bookingId,
  paymentId,
}: DeleteBookingPaymentButtonProps) {
  const [serverState, formAction] = useActionState(
    deleteBookingPaymentAction,
    initialDeleteBookingPaymentActionState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("Opravdu smazat tuto platbu?")) {
          event.preventDefault();
        }
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <DeletePaymentSubmitButton />
      {serverState.status === "error" && serverState.formError ? (
        <span className="max-w-48 text-right text-xs leading-4 text-red-300">{serverState.formError}</span>
      ) : null}
    </form>
  );
}

function SubmitPaymentButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Zapisuji platbu..." : "Zapsat platbu"}
    </button>
  );
}

function DeletePaymentSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-red-300/20 bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-400/16 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Mažu..." : "Smazat"}
    </button>
  );
}

function formatDateTimeLocalValue(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000;

  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}
