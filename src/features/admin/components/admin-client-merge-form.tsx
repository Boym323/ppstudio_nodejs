"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { mergeClientProfilesAction } from "@/features/admin/actions/client-merge-actions";
import { initialClientMergeActionState } from "@/features/admin/actions/client-merge-action-state";
import { type ClientMergePreviewProfile } from "@/features/admin/lib/client-merge-preview";

const inputClass = "mt-1 block w-full rounded-xl border border-white/12 bg-black/25 px-3 py-2 text-sm text-white";

export function AdminClientMergeForm({ clientId, fullName, email }: {
  clientId: string;
  fullName: string;
  email: string;
}) {
  const [state, action] = useActionState(mergeClientProfilesAction, initialClientMergeActionState);
  const preview = state.preview;

  if (state.status === "success") {
    return <div role="status" className="space-y-2 rounded-xl border border-emerald-300/20 bg-emerald-400/[.05] p-3 text-sm text-emerald-100">
      <p>{state.successMessage}</p>
      {state.targetHref ? <Link href={state.targetHref} className="inline-flex underline underline-offset-4">Otevřít zachovaný profil</Link> : null}
    </div>;
  }

  if (!preview || !state.previewToken) {
    return <form action={action} className="space-y-3">
      <input type="hidden" name="intent" value="preview" />
      <input type="hidden" name="sourceClientId" value={clientId} />
      <p className="text-sm text-white/70">Archivovaný profil: <strong className="text-white">{fullName}</strong> · {email}</p>
      <label className="block text-sm text-white/80">
        E-mail profilu, který má zůstat zachovaný
        <input type="email" name="targetEmail" required maxLength={254} autoComplete="off" className={inputClass} />
      </label>
      {state.formError ? <p role="alert" className="text-sm text-red-200">{state.formError}</p> : null}
      <SubmitButton label="Porovnat profily" />
    </form>;
  }

  return <form action={action} className="space-y-4">
    <input type="hidden" name="previewToken" value={state.previewToken} />
    <p className="text-sm text-white/75">Zkontrolujte, že jde o stejnou klientku a že směr sloučení je správný.</p>
    <div className="grid gap-2">
      <ProfileSummary title="Tento profil bude archivován" profile={preview.source} />
      <ProfileSummary title="Tento profil zůstane zachovaný" profile={preview.target} />
    </div>
    <fieldset className="space-y-2 text-sm text-white/80">
      <legend className="mb-1 font-semibold text-white">Jméno po sloučení na zachovaném profilu</legend>
      <p className="mb-2 text-xs text-white/60">Vyberte, které jméno se uloží na profilu „{preview.target.fullName}“.</p>
      <Choice name="nameChoice" value="source" text={`Použít jméno z archivovaného profilu: ${preview.source.fullName}`} />
      <Choice name="nameChoice" value="target" text={`Ponechat jméno zachovaného profilu: ${preview.target.fullName}`} defaultChecked />
    </fieldset>
    <fieldset className="space-y-2 text-sm text-white/80">
      <legend className="mb-2 font-semibold text-white">Telefon zachovaného profilu</legend>
      <Choice name="phoneChoice" value="source" text={preview.source.phone ?? "Bez telefonu"} />
      <Choice name="phoneChoice" value="target" text={preview.target.phone ?? "Bez telefonu"} />
    </fieldset>
    <p className="text-xs leading-5 text-white/65">Zvolený telefon se propíše do aktivních budoucích rezervací obou profilů. Při změně e-mailu rezervace se obnoví její odkazy a připraví aktuální potvrzení. Sloučení nelze v administraci automaticky vrátit; původní údaje zůstanou v auditu.</p>
    <label className="block text-sm text-white/80">
      Pro potvrzení opište e-mail archivovaného profilu: {preview.source.email}
      <input type="text" inputMode="email" name="confirmSourceEmail" required maxLength={254} autoComplete="off" className={inputClass} />
    </label>
    <label className="flex items-start gap-2 text-xs leading-5 text-white/70">
      <input type="checkbox" name="confirmEffects" required className="mt-1 accent-[var(--color-accent)]" />
      <span>Potvrzuji, že jde o stejnou klientku, a souhlasím s přesunem rezervací a historie do zachovaného profilu.</span>
    </label>
    {state.formError ? <p role="alert" className="text-sm text-red-200">{state.formError}</p> : null}
    <div className="flex flex-wrap gap-2">
      <SubmitButton label="Potvrdit sloučení" intent="merge" />
      <button type="submit" name="intent" value="reset" formNoValidate className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/75">Změnit cílový profil</button>
    </div>
  </form>;
}

function ProfileSummary({ title, profile }: { title: string; profile: ClientMergePreviewProfile }) {
  const formatDate = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Prague" });
  return <div className="rounded-xl border border-white/12 bg-black/20 p-3 text-sm text-white/75">
    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-100">{title}</p>
    <p className="font-semibold text-white">{profile.fullName}</p>
    <p>{profile.email} · {profile.phone ?? "Bez telefonu"}</p>
    <p>Rezervací celkem: {profile.bookingCount} · budoucích: {profile.upcoming.length}</p>
    <p className="text-xs text-white/60">Poslední návštěva: {profile.lastVisit ? `${formatDate.format(new Date(profile.lastVisit.startsAt))} · ${profile.lastVisit.service}` : "žádná"}</p>
    {profile.upcoming.slice(0, 3).map((booking) => <p key={booking.id} className="text-xs text-white/60">{formatDate.format(new Date(booking.startsAt))} · {booking.service}</p>)}
    {profile.upcoming.length > 3 ? <p className="text-xs text-white/60">Dalších budoucích rezervací: {profile.upcoming.length - 3}</p> : null}
  </div>;
}

function Choice({ name, value, text, defaultChecked = false }: { name: string; value: "source" | "target"; text: string; defaultChecked?: boolean }) {
  return <label className="flex items-start gap-2"><input type="radio" name={name} value={value} required defaultChecked={defaultChecked} className="mt-1 accent-[var(--color-accent)]" /><span>{text}</span></label>;
}

function SubmitButton({ label, intent }: { label: string; intent?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" name={intent ? "intent" : undefined} value={intent} disabled={pending} className="min-h-10 rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-60">{pending ? "Pracuji…" : label}</button>;
}
