"use client";

import { useId, useActionState, useState, useEffect } from "react";
import { useFormStatus } from "react-dom";

import { resolveBookingTimingSnapshot } from "@/features/booking/lib/booking-cleanup";

import { type AdminArea } from "@/config/navigation";
import { previewBookingServiceChangeAction, updateBookingServiceAction } from "@/features/admin/actions/bookings/update-booking-service";
import { initialUpdateBookingServiceActionState, type BookingServiceChangePreview } from "@/features/admin/actions/update-booking-service-action-state";

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
  clientEmail,
  expectedUpdatedAt,
  currentServiceId,
  scheduledStartsAt,
  services,
}: {
  area: AdminArea;
  bookingId: string;
  clientEmail: string;
  expectedUpdatedAt: string;
  currentServiceId: string;
  scheduledStartsAt: string;
  services: Array<{
    id: string;
    categoryName: string;
    name: string;
    durationMinutes: number;
    cleanupBlockMinutes: number;
    priceFromCzk: number | null;
  }>;
}) {
  const errorId = useId();
  const [selectedServiceId, setSelectedServiceId] = useState(currentServiceId);
  const [previewState, setPreviewState] = useState<{ key: string; result: BookingServiceChangePreview } | null>(null);
  const [confirmedOverrideKey, setConfirmedOverrideKey] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(true);
  const [serverState, formAction] = useActionState(
    updateBookingServiceAction,
    initialUpdateBookingServiceActionState,
  );
  const feedback = showFeedback ? serverState : initialUpdateBookingServiceActionState;
  const previewKey = `${area}:${bookingId}:${expectedUpdatedAt}:${selectedServiceId}`;
  const preview = previewState?.key === previewKey ? previewState.result : null;
  const serviceChanged = selectedServiceId !== currentServiceId;
  const overrideConfirmed = confirmedOverrideKey === previewKey;

  useEffect(() => {
    if (selectedServiceId === currentServiceId) return;
    let active = true;
    void previewBookingServiceChangeAction({ area, bookingId, serviceId: selectedServiceId, expectedUpdatedAt })
      .then((result) => {
        if (active) setPreviewState({ key: previewKey, result });
      })
      .catch(() => {
        if (active) setPreviewState({ key: previewKey, result: {
          status: "blocked", message: "Dostupnost se nepodařilo ověřit. Vyberte službu znovu nebo obnovte detail rezervace.",
        } });
      });
    return () => { active = false; };
  }, [area, bookingId, currentServiceId, expectedUpdatedAt, selectedServiceId, previewKey]);

  const currentService = services.find((service) => service.id === currentServiceId) ?? null;

  const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;
  const nextTiming = preview && preview.status !== "blocked" ? {
    serviceEnd: new Date(preview.serviceEndsAt),
    blockedUntil: new Date(preview.blockedUntil),
    cleanupBlockMinutes: preview.cleanupBlockMinutes,
  } : selectedService ? resolveBookingTimingSnapshot({
    startsAt: new Date(scheduledStartsAt),
    serviceDurationMinutes: selectedService.durationMinutes,
    cleanupBlockMinutes: selectedService.cleanupBlockMinutes,
  }) : null;
  const timeFormat = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit",
  });
  const dateFormat = new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric",
  });

  return (
    <details className="group rounded-[0.95rem] border border-white/8 bg-white/[0.03]">
      <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-white/78">
        Změnit službu
      </summary>

      <form action={formAction} onSubmit={() => setShowFeedback(true)} className="space-y-3 border-t border-white/8 px-3.5 py-3">
        <input type="hidden" name="area" value={area} />
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />

        {feedback.status === "success" && feedback.successMessage ? (
          <div role="status" className="rounded-[0.9rem] border border-emerald-300/16 bg-emerald-400/10 px-3 py-2 text-sm leading-5 text-emerald-50">
            {feedback.successMessage}
          </div>
        ) : null}

        {feedback.status === "error" && feedback.formError ? (
          <div role="alert" className="rounded-[0.9rem] border border-red-300/16 bg-red-400/10 px-3 py-2 text-sm leading-5 text-red-50">
            {feedback.formError}
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
            aria-invalid={Boolean(feedback.fieldErrors?.serviceId)}
            aria-describedby={feedback.fieldErrors?.serviceId ? `${errorId}-serviceId` : undefined}
            value={selectedServiceId}
            onChange={(event) => {
              setSelectedServiceId(event.target.value);
              setPreviewState(null);
              setConfirmedOverrideKey(null);
              setShowFeedback(false);
            }}
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
          {feedback.fieldErrors?.serviceId ? (
            <p id={`${errorId}-serviceId`} role="alert" className="mt-2 text-sm text-red-300">{feedback.fieldErrors.serviceId}</p>
          ) : null}
        </label>

        {nextTiming && selectedServiceId !== currentServiceId ? (
          <div aria-live="polite" className="rounded-[0.9rem] border border-white/8 bg-black/16 px-3.5 py-3 text-sm leading-5 text-white/75">
            <p className="font-medium text-white">Nový rozsah rezervace</p>
            <p className="mt-1">
              {dateFormat.format(new Date(scheduledStartsAt))} · {timeFormat.format(new Date(scheduledStartsAt))}–{timeFormat.format(nextTiming.serviceEnd)}
            </p>
            <p>Úklid {nextTiming.cleanupBlockMinutes} min · blokace do {dateFormat.format(nextTiming.blockedUntil)} {timeFormat.format(nextTiming.blockedUntil)}</p>
          </div>
        ) : null}

        {serviceChanged ? (
          <div role="status" aria-live="polite" className={`rounded-[0.9rem] border px-3.5 py-3 text-sm leading-5 ${
            !preview ? "border-white/8 bg-white/[0.03] text-white/65"
              : preview.status === "ready" ? "border-emerald-300/16 bg-emerald-400/10 text-emerald-50"
              : preview.status === "requires-override" ? "border-amber-300/20 bg-amber-400/10 text-amber-50"
              : "border-red-300/16 bg-red-400/10 text-red-50"
          }`}>
            <p className="font-medium">
              {!preview ? "Ověřuji možnost změny…" : preview.status === "ready" ? "Službu lze změnit"
                : preview.status === "requires-override" ? "Je potřeba potvrdit výjimku" : "Službu nyní nelze změnit"}
            </p>
            {preview ? <p className="mt-1">{preview.message}</p> : null}
          </div>
        ) : null}

        {preview?.status === "requires-override" ? (
          <label className="flex min-h-11 items-start gap-3 text-sm leading-5 text-white/75">
            <input
              type="checkbox" name="allowManualOverride" value="1" className="mt-1"
              checked={overrideConfirmed}
              onChange={(event) => setConfirmedOverrideKey(event.target.checked ? previewKey : null)}
            />
            <span>Potvrzuji prodloužení mimo vypsané termíny jako interní výjimku.</span>
          </label>
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-white">Důvod změny</span>
          <input
            type="text"
            name="reason"
            aria-invalid={Boolean(feedback.fieldErrors?.reason)}
            aria-describedby={feedback.fieldErrors?.reason ? `${errorId}-reason` : undefined}
            maxLength={300}
            placeholder="Např. po konzultaci na místě jsme péči upravili podle stavu pleti."
            className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
          />
          <span className="mt-1.5 block text-xs leading-4 text-white/40">
            Důvod se uloží do historie rezervace jako auditní stopa.
          </span>
          {feedback.fieldErrors?.reason ? (
            <p id={`${errorId}-reason`} role="alert" className="mt-2 text-sm text-red-300">{feedback.fieldErrors.reason}</p>
          ) : null}
        </label>

        <label className="flex min-h-11 items-start gap-3 text-sm leading-5 text-white/75">
          <input type="checkbox" name="notifyClient" value="1" defaultChecked={Boolean(clientEmail)} disabled={!clientEmail} className="mt-1" />
          <span>
            Informovat klientku e-mailem
            <span className="mt-1 block text-xs text-white/45">
              {clientEmail
                ? `Na ${clientEmail} odešleme novou službu, cenu a čas návštěvy s aktualizovanou událostí do kalendáře.`
                : "U rezervace chybí e-mail klientky. Změnu můžete uložit, oznámení nebude odeslané."}
            </span>
          </span>
        </label>

        <SubmitServiceButton disabled={!serviceChanged || !preview || preview.status === "blocked" || (preview.status === "requires-override" && !overrideConfirmed)} />
      </form>
    </details>
  );
}

function SubmitServiceButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/16 bg-transparent px-4 py-2 text-sm font-semibold text-white/86 transition hover:border-white/30 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Ukládám službu..." : "Uložit změnu služby"}
    </button>
  );
}
