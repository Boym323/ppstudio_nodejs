"use client";

import { useActionState, useEffect, useState } from "react";
import * as Dialog from "@/components/ui/dialog";
import { type AdminArea } from "@/config/navigation";
import { initialChangeServiceSlugActionState } from "@/features/admin/actions/change-service-slug-action-state";
import {
  changeServiceSlugAction,
} from "@/features/admin/actions/service-actions";
function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export function ChangeServiceSlugDialog({
  area,
  returnTo,
  serviceId,
  currentSlug,
  aliases,
}: {
  area: AdminArea;
  returnTo: string;
  serviceId: string;
  currentSlug: string;
  aliases: Array<{ id: string; slug: string; createdAt: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [targetSlug, setTargetSlug] = useState(currentSlug);
  const [state, formAction, pending] = useActionState(
    changeServiceSlugAction,
    initialChangeServiceSlugActionState,
  );

  useEffect(() => {
    if (state.status === "success") {
      window.location.reload();
    }
  }, [state.status]);

  return (
    <section className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
      <h4 className="font-display text-xl text-white">Veřejná URL</h4>
      <p className="mt-1 text-sm leading-6 text-white/62">Změna slugu je samostatná operace. Název služby ho nikdy nemění automaticky.</p>
      <div className="mt-4 grid gap-3 text-sm text-white/75">
        <p>Aktuální URL: <a className="text-[var(--color-accent-soft)] underline" href={`/sluzby/${encodeURIComponent(currentSlug)}`} target="_blank" rel="noreferrer">/sluzby/{currentSlug}</a></p>
        <p>Slug: <code className="rounded bg-black/20 px-2 py-1 text-white">{currentSlug}</code></p>
      </div>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button type="button" className="mt-4 min-h-11 rounded-full border border-[var(--color-accent)]/50 bg-[rgba(190,160,120,.1)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-soft)]">Změnit URL</button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="w-[min(34rem,calc(100vw-2rem))] rounded-[1.4rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6">
            <Dialog.Title>Změnit veřejnou URL služby</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-white/68">Původní URL zůstane funkční a bude trvale přesměrována na novou adresu.</Dialog.Description>
            <form action={formAction} className="mt-5 space-y-4">
              <input type="hidden" name="area" value={area} />
              <input type="hidden" name="serviceId" value={serviceId} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <div className="text-sm text-white/72">Aktuální slug: <code className="text-white">{currentSlug}</code></div>
              <label className="block text-sm text-white/78">Nový slug
                <input
                  name="targetSlug"
                  value={targetSlug}
                  maxLength={80}
                  onChange={(event) => setTargetSlug(event.target.value)}
                  onBlur={() => setTargetSlug(normalizeSlug(targetSlug))}
                  className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]/60"
                  autoFocus
                />
              </label>
              <p className="text-sm text-white/62">Nová URL: <code className="text-white">/sluzby/{targetSlug || "…"}</code></p>
              {state.status === "error" ? <p className="rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm text-red-50">{state.formError}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild><button type="button" className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white/78">Zrušit</button></Dialog.Close>
                <button type="submit" disabled={pending} className="min-h-11 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">{pending ? "Měním URL…" : "Změnit URL"}</button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="mt-5 border-t border-white/10 pt-4">
        <h5 className="text-sm font-medium text-white">Historické URL</h5>
        <p className="mt-1 text-xs leading-5 text-white/52">Tyto adresy zůstávají trvale funkční a přesměrují na aktuální URL.</p>
        {aliases.length > 0 ? <ul className="mt-3 space-y-2 text-sm text-white/72">{aliases.map((alias) => <li key={alias.id}><code>/sluzby/{alias.slug}</code></li>)}</ul> : <p className="mt-3 text-sm text-white/48">Zatím nebyla změněna.</p>}
      </div>
    </section>
  );
}
