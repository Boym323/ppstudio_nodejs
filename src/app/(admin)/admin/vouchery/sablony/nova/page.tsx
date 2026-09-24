import Link from "next/link";
import { AdminRole } from "@/generated/prisma/client";
import { createVoucherTemplateAction } from "@/features/admin/actions/voucher-template-actions";
import { AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { AdminVoucherTabs } from "@/features/admin/components/admin-voucher-stock-pages";
import { requireRole } from "@/lib/auth/session";

export default async function NewVoucherTemplatePage() {
  await requireRole([AdminRole.OWNER]);

  return (
    <AdminPageShell eyebrow="Vouchery / Šablony" title="Vytvořit šablonu" description="Začněte novým draftem. Publikované verze zůstávají neměnné.">
      <div className="space-y-4">
        <AdminVoucherTabs area="owner" active="templates" />
        <form action={createVoucherTemplateAction} className="max-w-2xl rounded-[var(--radius-panel)] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
          <div className="max-w-xl"><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent-soft)]">Nový design</p><h3 className="mt-2 font-display text-2xl text-white sm:text-3xl">Pojmenujte voucherovou šablonu</h3><p className="mt-3 text-sm leading-6 text-white/65">Vytvoříme pracovní draft s výchozím layoutem. PDF master a přesné pozice upravíte v dalším kroku.</p></div>
          <div className="mt-7 grid gap-5">
            <label className="block text-sm text-white/75">Název šablony<input required name="label" placeholder="např. Klasický voucher" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none placeholder:text-white/30 focus:border-[var(--color-accent)]/70 focus:ring-2 focus:ring-[var(--color-accent)]/15" /></label>
            <label className="block text-sm text-white/75">Interní označení kolekce<input required name="familyKey" pattern="[A-Za-z0-9 -]+" placeholder="např. classic" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none placeholder:text-white/30 focus:border-[var(--color-accent)]/70 focus:ring-2 focus:ring-[var(--color-accent)]/15" /><span className="mt-2 block text-xs leading-5 text-white/50">Krátký klíč pro interní evidenci a verzování. Používejte písmena, čísla, mezery nebo pomlčku.</span></label>
          </div>
          <div className="mt-7 flex flex-col gap-2 border-t border-white/10 pt-5 sm:flex-row sm:items-center"><button className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105">Vytvořit draft</button><Link href="/admin/vouchery/sablony" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-white/25 hover:text-white">Zpět na šablony</Link></div>
        </form>
      </div>
    </AdminPageShell>
  );
}
