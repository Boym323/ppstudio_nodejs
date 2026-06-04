"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { type AdminArea } from "@/config/navigation";
import { updateBookingServiceAction } from "@/features/admin/actions/booking-actions";
import { initialUpdateBookingServiceActionState } from "@/features/admin/actions/update-booking-service-action-state";

function formatPrice(priceFromCzk: number | null) {
  if (!priceFromCzk) {
    return "Cena na dotaz";
  }

  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(priceFromCzk);
}

export function AdminBookingServiceForm({
  area,
  bookingId,
  expectedUpdatedAt,
  currentServiceId,
  services,
}: {
  area: AdminArea;
  bookingId: string;
  expectedUpdatedAt: string;
  currentServiceId: string;
  services: Array<{
    id: string;
    categoryName: string;
    name: string;
    durationMinutes: number;
    cleanupBlockMinutes: number;
    priceFromCzk: number | null;
  }>;
}) {
  const [serverState, formAction] = useActionState(
    updateBookingServiceAction,
    initialUpdateBookingServiceActionState,
  );
  const currentService = services.find((service) => service.id === currentServiceId) ?? null;

  return (
    <details className="group rounded-[0.95rem] border border-white/8 bg-white/[0.03]">
      <summary className="cursor-pointer list-none px-3.5 py-3 marker:hidden">
        <span className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/16 bg-transparent px-4 py-2 text-sm font-semibold text-white/82 transition group-open:hidden hover:border-white/28 hover:bg-white/8 hover:text-white">
          Změnit službu
        </span>
        <span className="hidden text-sm font-medium text-white/78 group-open:inline">
          Přepsat službu v rezervaci
        </span>
      </summary>

      <form action={formAction} className="space-y-3 border-t border-white/8 px-3.5 py-3">
        <input type="hidden" name="area" value={area} />
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />

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

        {currentService ? (
          <div className="rounded-[0.9rem] border border-white/8 bg-black/16 px-3.5 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Aktuální služba</p>
            <p className="mt-2 text-sm font-medium text-white">{currentService.name}</p>
            <p className="mt-1 text-sm leading-5 text-white/60">
              {currentService.categoryName}
              <span className="mx-1.5 text-white/28">·</span>
              {currentService.durationMinutes} min
              {currentService.cleanupBlockMinutes > 0 ? (
                <>
                  <span className="mx-1.5 text-white/28">·</span>
                  blokace {currentService.cleanupBlockMinutes} min
                </>
              ) : null}
              <span className="mx-1.5 text-white/28">·</span>
              {formatPrice(currentService.priceFromCzk)}
            </p>
          </div>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-white">Nová služba</span>
          <select
            name="serviceId"
            defaultValue={currentServiceId}
            className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/55"
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.categoryName} / {service.name} ({service.durationMinutes} min)
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs leading-4 text-white/40">
            Změna přepočítá délku služby, cleanup blokaci a ceníkový základ rezervace. Individuální finální cena zůstává.
          </span>
          {serverState.fieldErrors?.serviceId ? (
            <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.serviceId}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-white">Důvod změny</span>
          <input
            type="text"
            name="reason"
            maxLength={300}
            placeholder="Např. po konzultaci na místě jsme péči upravili podle stavu pleti."
            className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
          />
          <span className="mt-1.5 block text-xs leading-4 text-white/40">
            Důvod se uloží do historie rezervace jako auditní stopa.
          </span>
          {serverState.fieldErrors?.reason ? (
            <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.reason}</p>
          ) : null}
        </label>

        <SubmitServiceButton />
      </form>
    </details>
  );
}

function SubmitServiceButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/16 bg-transparent px-4 py-2 text-sm font-semibold text-white/86 transition hover:border-white/30 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Ukládám službu..." : "Uložit změnu služby"}
    </button>
  );
}
