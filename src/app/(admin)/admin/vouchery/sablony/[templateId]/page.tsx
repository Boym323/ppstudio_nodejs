import { notFound } from "next/navigation";
import { AdminRole } from "@/generated/prisma/client";

import {
  publishVoucherTemplateAction,
  sendTestVoucherTemplateEmailAction,
  uploadVoucherTemplateMasterAction,
} from "@/features/admin/actions/voucher-template-actions";
import { AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { AdminVoucherTabs } from "@/features/admin/components/admin-voucher-stock-pages";
import { DeactivateVoucherTemplateForm } from "@/features/admin/components/deactivate-voucher-template-form";
import { VoucherTemplateLayoutEditor } from "@/features/admin/components/voucher-template-layout-editor";
import { VoucherTemplateOverflowMenu } from "@/features/admin/components/voucher-template-overflow-menu";
import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import { AdminVoucherTemplatePreview } from "@/features/admin/components/admin-voucher-template-preview";
import { voucherTemplateLayoutSchema } from "@/features/vouchers/lib/voucher-template-layout";
import { requireVoucherTemplateById } from "@/features/vouchers/lib/voucher-template-repository";
import { requireRole } from "@/lib/auth/session";

export default async function VoucherTemplateDetailPage({ params }: { params: Promise<{ templateId: string }> }) {
  await requireRole([AdminRole.OWNER]);
  let template;
  try {
    template = await requireVoucherTemplateById((await params).templateId);
  } catch {
    notFound();
  }

  const templateId = template.id;
  const previewUrl = template.previewStoragePath && template.masterSha256
    ? `/api/admin/voucher-templates/${template.id}/preview?v=${template.updatedAt.getTime()}`
    : undefined;

  return (
    <AdminPageShell
      eyebrow="Vouchery / Šablony"
      title={template.label}
      description={`${template.key} · verze šablony ${template.status === "DRAFT" ? "v přípravě" : "publikovaná"}`}
      denseIntro
      headerActions={
        <div className="flex flex-wrap justify-end gap-2">
          {template.status === "DRAFT" ? <form action={uploadVoucherTemplateMasterAction} className="flex items-center gap-2">
            <input type="hidden" name="templateId" value={template.id} />
            <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/25 hover:text-white">
              <span>Vybrat PDF</span>
              <input required name="master" type="file" accept="application/pdf,.pdf" className="sr-only" />
            </label>
            <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/25 hover:text-white">Nahrát</button>
          </form> : null}
          {template.status === "DRAFT" ? <form action={publishVoucherTemplateAction.bind(null, template.id)}><button className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105">Publikovat</button></form> : null}
          <VoucherTemplateOverflowMenu templateId={templateId} canDelete={template.status === "DRAFT"} />
        </div>
      }
    >
      <div className="space-y-5">
        <AdminVoucherTabs area="owner" active="templates" />
        <section className="rounded-[var(--radius-panel)] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${template.masterStoragePath ? "bg-emerald-300" : "bg-white/30"}`} aria-hidden="true" />
              <div><p className="text-sm font-semibold text-white">PDF master {template.masterStoragePath ? "je nahrán" : "chybí"}</p><p className="mt-0.5 text-xs text-white/55">{template.masterStoragePath ? "Náhled a layout jsou připravené k úpravám." : "Nahrajte PDF, aby bylo možné zkontrolovat finální vzhled."}</p></div>
            </div>
            <AdminStatePill tone={template.status === "DRAFT" ? "accent" : "active"}>{template.status === "DRAFT" ? "Draft" : "Publikováno"}</AdminStatePill>
          </div>
          {template.status === "PUBLISHED" ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"><p className="text-sm text-white/60">Publikovaná verze zůstává neměnná. Pro další úpravy vytvořte novou verzi.</p><DeactivateVoucherTemplateForm templateId={templateId} /></div> : null}
          {template.status === "DRAFT" ? <form action={sendTestVoucherTemplateEmailAction} className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-end"><input type="hidden" name="templateId" value={template.id} /><label className="min-w-0 flex-1 text-xs text-white/65">Testovací e-mail<input required type="email" name="recipientEmail" placeholder="např. studio@ppstudio.cz" className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/70" /></label><button className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white">Odeslat test</button></form> : null}
        </section>
        {template.status === "DRAFT" ? <VoucherTemplateLayoutEditor templateId={template.id} initialLayout={voucherTemplateLayoutSchema.parse(template.layout)} previewSrc={previewUrl} /> : <section className="grid gap-5 rounded-[var(--radius-panel)] border border-white/10 bg-white/[0.035] p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] md:items-center"><AdminVoucherTemplatePreview src={previewUrl} alt={`Náhled šablony ${template.label}`} /><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">Publikovaná verze</p><h3 className="mt-2 font-display text-2xl text-white">Layout je uzamčený</h3><p className="mt-3 text-sm leading-6 text-white/65">Přesné souřadnice a typografie této verze zůstávají zachované pro vystavené vouchery. Nová verze začne jako kopie tohoto layoutu.</p><details className="mt-5"><summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Technické údaje layoutu</summary><pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/8 bg-black/20 p-3 text-xs text-white/55">{JSON.stringify(template.layout, null, 2)}</pre></details></div></section>}
      </div>
    </AdminPageShell>
  );
}
