"use client";

import { useState } from "react";

import {
  cloneVoucherTemplateVersionAction,
  deleteVoucherTemplateDraftAction,
} from "@/features/admin/actions/voucher-template-actions";

export function VoucherTemplateOverflowMenu({ templateId, canDelete }: { templateId: string; canDelete: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="menu" aria-label="Další akce šablony" onClick={() => setOpen((current) => !current)} className="inline-flex min-h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-lg text-white/75 transition hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/70">•••</button>
      {open ? <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-white/10 bg-[#1a171b] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
        <form action={cloneVoucherTemplateVersionAction.bind(null, templateId)}><button type="submit" role="menuitem" className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-white/80 hover:bg-white/8 hover:text-white">Vytvořit novou verzi</button></form>
        {canDelete ? <form action={deleteVoucherTemplateDraftAction.bind(null, templateId)} onSubmit={(event) => { if (!window.confirm("Opravdu chcete smazat tento draft? Akci nelze vrátit.")) event.preventDefault(); }}><button type="submit" role="menuitem" className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-rose-200 hover:bg-rose-400/10">Smazat draft</button></form> : null}
      </div> : null}
    </div>
  );
}
