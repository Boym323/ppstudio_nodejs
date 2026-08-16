"use client";

import { useState } from "react";

import { closeEmailIncidentAction } from "../actions/email-log-actions";
import * as AlertDialog from "@/components/ui/alert-dialog";

const reasons = [
  { value: "HISTORICAL", label: "Historický" },
  { value: "CONTACTED_OTHER_WAY", label: "Kontaktována jinak" },
  { value: "NO_LONGER_RELEVANT", label: "Již nerelevantní" },
  { value: "OTHER", label: "Jiný důvod" },
] as const;

export function EmailIncidentResolutionForm({ emailLogId }: { emailLogId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof reasons)[number]["value"]>("HISTORICAL");

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <button
          type="button"
          className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-3.5 py-2 text-sm font-semibold text-emerald-50 transition hover:border-emerald-300/60 hover:bg-emerald-400/18"
        >
          Uzavřít incident
        </button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay />
        <AlertDialog.Content className="w-[min(32rem,calc(100vw-2rem))] rounded-[1.4rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6">
          <AlertDialog.Title>Uzavřít incident</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-5 text-white/68">
            Incident zmizí z Pozornosti. Historie e-mailu zůstane beze změny.
          </AlertDialog.Description>
          <form action={closeEmailIncidentAction} className="mt-5 space-y-4">
            <input type="hidden" name="emailLogId" value={emailLogId} />
            <label className="block text-sm font-medium text-white">
              Důvod
              <select
                name="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value as (typeof reasons)[number]["value"])}
                className="mt-1.5 block min-h-11 w-full rounded-xl border border-white/12 bg-black/25 px-3 text-sm text-white"
              >
                {reasons.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-white">
              Poznámka{reason === "OTHER" ? " (povinná)" : " (volitelná)"}
              <textarea
                name="note"
                rows={3}
                maxLength={300}
                required={reason === "OTHER"}
                className="mt-1.5 block w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button type="button" className="rounded-full border border-white/12 px-4 py-2 text-sm font-semibold text-white/80">Zpět</button>
              </AlertDialog.Cancel>
              <button
                type="submit"
                className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
              >
                Uzavřít incident
              </button>
            </div>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
