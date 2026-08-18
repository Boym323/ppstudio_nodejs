"use client";

import { BookingPaymentMethod } from "@/generated/prisma/browser";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createBookingPaymentAction,
  deleteBookingPaymentAction,
  updateBookingPaymentAction,
} from "@/features/bookings/actions/booking-payment-actions";
import {
  initialCreateBookingPaymentActionState,
  initialDeleteBookingPaymentActionState,
  initialUpdateBookingPaymentActionState,
  type CreateBookingPaymentActionState,
} from "@/features/bookings/actions/booking-payment-action-state";
import { BOOKING_PAYMENT_METHOD_LABELS } from "@/features/bookings/lib/booking-payment-summary";
import { type AdminBookingDetailData } from "@/features/admin/lib/admin-booking";
import { createIdempotencyKey } from "@/lib/idempotency-key";

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

type EditBookingPaymentFormProps = DeleteBookingPaymentButtonProps & {
  amountCzk: number; method: BookingPaymentMethod; paidAt: string; note: string | null; expectedUpdatedAt: string;
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
  const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
  const [isOpen, setIsOpen] = useState(false);
  const [serverState, formAction] = useActionState(async (
    previousState: CreateBookingPaymentActionState,
    formData: FormData,
  ) => {
    const result = await createBookingPaymentAction(previousState, formData);

    if (result.status === "success") {
      setIdempotencyKey(createIdempotencyKey());
    }

    return result;
  }, initialCreateBookingPaymentActionState);

  return (
    <details
      className="group rounded-[0.95rem] border border-white/8 bg-white/[0.03]"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary
        className="cursor-pointer list-none px-3 py-2.5 marker:hidden"
        aria-expanded={isOpen}
      >
        <span className="inline-flex min-h-9 items-center justify-center rounded-full bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition group-open:hidden hover:brightness-105">
          + Zapsat platbu
        </span>
        <span className="hidden text-sm font-medium text-white/78 group-open:inline">
          Zapsat platbu mimo voucher
        </span>
      </summary>

      <form action={formAction} className="space-y-2.5 border-t border-white/8 px-3 py-2.5">
        <input type="hidden" name="area" value={area} />
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <input type="hidden" name="confirmSimilarPayment" value={serverState.similarPayment ? "true" : ""} />

        {serverState.status === "success" && serverState.successMessage ? (
          <div className="max-w-full break-words rounded-[0.9rem] border border-emerald-300/16 bg-emerald-400/10 px-3 py-2 text-sm leading-5 text-emerald-50">
            {serverState.successMessage}
          </div>
        ) : null}

        {serverState.status === "error" && serverState.formError ? (
          <div className="max-w-full break-words rounded-[0.9rem] border border-red-300/16 bg-red-400/10 px-3 py-2 text-sm leading-5 text-red-50">
            {serverState.formError}
          </div>
        ) : null}
        {serverState.similarPayment ? (
          <div className="rounded-[0.9rem] border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm leading-5 text-amber-50">
            Podobná platba {serverState.similarPayment.amountCzk} Kč metodou {serverState.similarPayment.methodLabel} byla zaznamenána před {serverState.similarPayment.minutesAgo} min. <a href={`#payment-${serverState.similarPayment.id}`} className="underline">Zobrazit existující platbu</a>. Dalším odesláním vědomě pokračujete.
          </div>
        ) : null}

        <div className="grid gap-2.5 md:grid-cols-3">
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
              className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
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
              className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/55"
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
              className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3 py-2 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/55"
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
            className="mt-1.5 w-full resize-y rounded-[0.85rem] border border-white/8 bg-black/20 px-3 py-2 text-sm leading-5 text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
          />
          {serverState.fieldErrors?.note ? (
            <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.note}</p>
          ) : null}
        </label>

        <SubmitPaymentButton confirmSimilar={Boolean(serverState.similarPayment)} />
      </form>
    </details>
  );
}

export function EditBookingPaymentForm({ area, bookingId, paymentId, amountCzk, method, paidAt, note, expectedUpdatedAt }: EditBookingPaymentFormProps) {
  const [serverState, formAction] = useActionState(updateBookingPaymentAction, initialUpdateBookingPaymentActionState);
  return (
    <details className="group rounded border border-white/10 bg-black/10">
      <summary className="cursor-pointer px-2 py-1 text-xs font-semibold text-white/72 marker:hidden">Upravit platbu</summary>
      <form action={formAction} className="grid gap-2 border-t border-white/8 p-2 sm:grid-cols-2">
        <input type="hidden" name="area" value={area} /><input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="paymentId" value={paymentId} /><input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
        <label className="text-xs text-white/65">Částka<input required type="number" min={1} step={1} name="amountCzk" defaultValue={amountCzk} className="mt-1 block w-full rounded border border-white/15 bg-black/20 px-2 py-1 text-sm text-white" /></label>
        <label className="text-xs text-white/65">Metoda<select name="method" defaultValue={method} className="mt-1 block w-full rounded border border-white/15 bg-black/20 px-2 py-1 text-sm text-white">{paymentMethods.map((value) => <option key={value} value={value} className="bg-neutral-950">{BOOKING_PAYMENT_METHOD_LABELS[value]}</option>)}</select></label>
        <label className="text-xs text-white/65">Datum platby<input required type="datetime-local" name="paidAt" defaultValue={formatDateTimeLocalValue(new Date(paidAt))} className="mt-1 block w-full rounded border border-white/15 bg-black/20 px-2 py-1 text-sm text-white" /></label>
        <label className="text-xs text-white/65">Poznámka<textarea name="note" rows={2} maxLength={500} defaultValue={note ?? ""} className="mt-1 block w-full rounded border border-white/15 bg-black/20 px-2 py-1 text-sm text-white" /></label>
        {serverState.status === "error" && serverState.formError ? <p className="sm:col-span-2 text-xs text-red-300">{serverState.formError}</p> : null}
        {serverState.status === "success" && serverState.successMessage ? <p className="sm:col-span-2 text-xs text-emerald-200">{serverState.successMessage}</p> : null}
        <EditPaymentSubmitButton />
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
        if (!window.confirm("Opravdu stornovat tuto platbu? Zůstane zachovaná v historii.")) {
          event.preventDefault();
        }
      }}
      className="inline-flex flex-col items-end gap-1"
    >
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <label className="text-left text-xs text-white/65">
        Důvod storna
        <input name="voidReason" required maxLength={500} className="mt-1 block w-48 rounded border border-white/15 bg-black/20 px-2 py-1 text-sm text-white" />
      </label>
      <DeletePaymentSubmitButton />
      {serverState.status === "error" && serverState.formError ? (
        <span className="max-w-48 text-right text-xs leading-4 text-red-300">{serverState.formError}</span>
      ) : null}
    </form>
  );
}

function SubmitPaymentButton({ confirmSimilar = false }: { confirmSimilar?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-9 items-center justify-center rounded-full bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Zapisuji platbu..." : confirmSimilar ? "Přesto zapsat platbu" : "Zapsat platbu"}
    </button>
  );
}

function EditPaymentSubmitButton() { const { pending } = useFormStatus(); return <button type="submit" disabled={pending} className="w-fit rounded-full border border-white/16 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{pending ? "Ukládám..." : "Uložit úpravu"}</button>; }

function DeletePaymentSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-red-300/20 bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-400/16 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Stornuji..." : "Stornovat"}
    </button>
  );
}

function formatDateTimeLocalValue(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000;

  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}
