"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";

import { type AdminArea } from "@/config/navigation";
import { rescheduleBookingAction } from "@/features/admin/actions/booking-actions";
import {
  initialRescheduleBookingActionState,
} from "@/features/admin/actions/reschedule-booking-action-state";
import { AdminEscapeKeyClose } from "@/features/admin/components/admin-drawer-escape-close";
import { BookingRescheduleTimeSelector } from "./booking-reschedule-time-selector";

type SlotCatalogItem = {
  id: string;
  startsAt: string;
  endsAt: string;
  publicNote: string | null;
  capacity: number;
  serviceRestrictionMode: "ANY" | "SELECTED";
  allowedServiceIds: string[];
  bookedIntervals: Array<{
    startsAt: string;
    endsAt: string;
  }>;
};

type RescheduleBookingButtonProps = {
  area: AdminArea;
  bookingId: string;
  serviceId: string;
  serviceName: string;
  serviceDurationMinutes: number;
  currentScheduledAtLabel: string;
  currentStartsAt: string;
  expectedUpdatedAt: string;
  rescheduleCount: number;
  slots: SlotCatalogItem[];
  variant?: "panel" | "inline";
};

function getInitialManualDate(isoValue: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoValue));
}

function getInitialManualTime(isoValue: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoValue));
}

export function RescheduleBookingButton({
  area,
  bookingId,
  serviceId,
  serviceName,
  serviceDurationMinutes,
  currentScheduledAtLabel,
  currentStartsAt,
  expectedUpdatedAt,
  rescheduleCount,
  slots,
  variant = "panel",
}: RescheduleBookingButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState<"slot" | "manual">("slot");
  const [slotId, setSlotId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [manualDate, setManualDate] = useState(getInitialManualDate(currentStartsAt));
  const [manualTime, setManualTime] = useState(getInitialManualTime(currentStartsAt));
  const [reason, setReason] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);
  const [includeCalendarAttachment, setIncludeCalendarAttachment] = useState(true);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [serverState, formAction] = useActionState(
    rescheduleBookingAction,
    initialRescheduleBookingActionState,
  );
  const previousStatus = useRef(serverState.status);
  const canUsePortal = typeof window !== "undefined";

  useEffect(() => {
    if (previousStatus.current !== "success" && serverState.status === "success") {
      setOpen(false);
      setShowSuccessBanner(true);
      router.refresh();
    }

    previousStatus.current = serverState.status;
  }, [router, serverState.status]);

  function resetForm() {
    setSelectionMode("slot");
    setSlotId("");
    setStartsAt("");
    setManualDate(getInitialManualDate(currentStartsAt));
    setManualTime(getInitialManualTime(currentStartsAt));
    setReason("");
    setNotifyClient(true);
    setIncludeCalendarAttachment(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetForm();
          setShowSuccessBanner(false);
          setOpen(true);
        }}
        className={
          variant === "inline"
            ? "rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/76 transition hover:border-white/18 hover:bg-white/6 hover:text-white"
            : "rounded-[1rem] border border-[var(--color-accent)]/35 bg-[rgba(190,160,120,0.12)] px-3.5 py-3 text-left transition hover:border-[var(--color-accent)]/45"
        }
      >
        {variant === "inline" ? (
          "Přesunout termín"
        ) : (
          <>
            <span className="block text-sm font-medium text-white">Přesunout termín</span>
            <span className="mt-1 block text-sm leading-5 text-white/60">
              Samostatná akce s validací, historií a navázaným oznámením klientce.
            </span>
          </>
        )}
      </button>

      {!open && showSuccessBanner && serverState.status === "success" ? (
        <div className="mt-3 rounded-[1rem] border border-emerald-300/18 bg-emerald-500/10 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-50">{serverState.successMessage}</p>
              {serverState.warningMessage ? (
                <p className="mt-1 text-sm leading-6 text-emerald-100/80">{serverState.warningMessage}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setShowSuccessBanner(false)}
              className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
            >
              Zavřít
            </button>
          </div>
        </div>
      ) : null}

      {canUsePortal && open
        ? createPortal(
            <div className="fixed inset-0 z-[90]">
              <AdminEscapeKeyClose onEscape={() => setOpen(false)} />
              <div className="absolute inset-0 bg-black/62 backdrop-blur-sm" onClick={() => setOpen(false)} />
              <div className="absolute inset-y-0 right-0 w-full max-w-3xl overflow-hidden border-l border-white/10 bg-[#131116] shadow-[-20px_0_70px_rgba(0,0,0,0.45)]">
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent-soft)]">
                        Přesun rezervace
                      </p>
                      <h2 className="mt-2 text-2xl font-display text-white">Změnit termín bez tiché editace</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/66">
                        Rezervace zůstane stejný booking, ale změna projde validací, auditním logem a návazným workflow.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/74 transition hover:border-white/18 hover:bg-white/6"
                    >
                      Zavřít
                    </button>
                  </div>

                  <form action={formAction} className="flex min-h-0 flex-1 flex-col">
                    <input type="hidden" name="area" value={area} />
                    <input type="hidden" name="bookingId" value={bookingId} />
                    <input type="hidden" name="selectionMode" value={selectionMode} />
                    <input type="hidden" name="slotId" value={slotId} />
                    <input type="hidden" name="startsAt" value={startsAt} />
                    <input type="hidden" name="manualDate" value={selectionMode === "manual" ? manualDate : ""} />
                    <input type="hidden" name="manualTime" value={selectionMode === "manual" ? manualTime : ""} />
                    <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
                    <input type="hidden" name="reason" value={reason} />
                    <input type="hidden" name="notifyClient" value={notifyClient ? "1" : "0"} />
                    <input type="hidden" name="includeCalendarAttachment" value={includeCalendarAttachment ? "1" : "0"} />

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                      <div className="space-y-4 pb-28">
                        {serverState.status === "success" && serverState.successMessage ? (
                          <div className="rounded-[1rem] border border-emerald-300/18 bg-emerald-500/10 px-4 py-3">
                            <p className="text-sm font-medium text-emerald-50">{serverState.successMessage}</p>
                            {serverState.warningMessage ? (
                              <p className="mt-2 text-sm leading-6 text-emerald-100/80">{serverState.warningMessage}</p>
                            ) : null}
                          </div>
                        ) : null}

                        {serverState.status === "error" && serverState.formError ? (
                          <div className="rounded-[1rem] border border-red-300/16 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-50">
                            {serverState.formError}
                          </div>
                        ) : null}

                        <section className="grid gap-3 md:grid-cols-2">
                          <InfoCard label="Současný termín" value={currentScheduledAtLabel} />
                          <InfoCard label="Služba" value={`${serviceName} • ${serviceDurationMinutes} min`} detail={rescheduleCount > 0 ? `Přesunuto už ${rescheduleCount}×` : "První změna termínu"} />
                        </section>

                        <BookingRescheduleTimeSelector
                          slots={slots}
                          serviceId={serviceId}
                          serviceDurationMinutes={serviceDurationMinutes}
                          selectionMode={selectionMode}
                          onSelectionModeChange={setSelectionMode}
                          slotId={slotId}
                          onSlotIdChange={setSlotId}
                          startsAt={startsAt}
                          onStartsAtChange={setStartsAt}
                          manualDate={manualDate}
                          onManualDateChange={setManualDate}
                          manualTime={manualTime}
                          onManualTimeChange={setManualTime}
                          errorSlot={serverState.fieldErrors?.slotId}
                          errorManualDate={serverState.fieldErrors?.manualDate}
                          errorManualTime={serverState.fieldErrors?.manualTime}
                        />

                        <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
                            4. Důvod změny
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-white">Volitelná poznámka do historie</h3>
                          <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            maxLength={300}
                            rows={4}
                            placeholder="Např. klientka volala a potřebovala posunout termín, nebo salon přesouvá rezervaci z provozních důvodů."
                            className="mt-4 w-full rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
                          />
                          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-white/42">
                            <span>Uloží se do auditní historie přesunu.</span>
                            <span>{reason.length}/300</span>
                          </div>
                          {serverState.fieldErrors?.reason ? <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.reason}</p> : null}
                        </section>

                        <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
                            5. Oznámení klientce
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-white">Co se má stát po přesunu</h3>
                          <div className="mt-4 grid gap-2">
                            <CheckboxRow
                              checked={notifyClient}
                              label="Poslat e-mail o změně termínu"
                              description="Založí se samostatný email typu „Termín byl změněn“ do stejné email pipeline jako ostatní booking zprávy."
                              onChange={setNotifyClient}
                            />
                            <CheckboxRow
                              checked={includeCalendarAttachment}
                              label="Přiložit novou .ics událost"
                              description="Hodí se hlavně u potvrzených rezervací, aby si klientka mohla termín přepsat v kalendáři jedním klikem."
                              onChange={setIncludeCalendarAttachment}
                              disabled={!notifyClient}
                            />
                          </div>
                        </section>
                      </div>
                    </div>

                    <div className="sticky bottom-0 border-t border-white/10 bg-[#131116]/96 px-5 py-4 backdrop-blur sm:px-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm leading-6 text-white/58">
                          OWNER i SALON používají stejnou doménovou akci i stejné validace. Rozdíl je jen v admin cestě.
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/76 transition hover:border-white/18 hover:bg-white/6"
                          >
                            Zrušit
                          </button>
                          <SubmitButton />
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function InfoCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[1.05rem] border border-white/7 bg-white/[0.035] p-3.5">
      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-white/46">{label}</p>
      <p className="mt-1.5 text-sm leading-6 text-white">{value}</p>
      {detail ? <p className="mt-1 text-sm leading-5 text-white/54">{detail}</p> : null}
    </div>
  );
}

function CheckboxRow({
  checked,
  label,
  description,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}>
      <span className="flex items-start gap-3 rounded-[1rem] border border-white/8 bg-black/12 px-3.5 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          className="mt-1 h-4 w-4 rounded border-white/20 bg-black/20 text-[var(--color-accent)]"
        />
        <span>
          <span className="block text-sm font-medium text-white">{label}</span>
          <span className="mt-1 block text-sm leading-5 text-white/62">{description}</span>
        </span>
      </span>
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
    >
      {pending ? "Přesouvám termín..." : "Potvrdit přesun"}
    </button>
  );
}
