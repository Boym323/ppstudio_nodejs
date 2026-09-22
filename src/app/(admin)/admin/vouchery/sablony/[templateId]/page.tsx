import { notFound } from "next/navigation";
import { AdminRole } from "@/generated/prisma/client";

import {
  cloneVoucherTemplateVersionAction,
  deleteVoucherTemplateDraftAction,
  publishVoucherTemplateAction,
  sendTestVoucherTemplateEmailAction,
  uploadVoucherTemplateMasterAction,
} from "@/features/admin/actions/voucher-template-actions";
import { AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { AdminVoucherTabs } from "@/features/admin/components/admin-voucher-stock-pages";
import { DeactivateVoucherTemplateForm } from "@/features/admin/components/deactivate-voucher-template-form";
import { VoucherTemplateLayoutEditor } from "@/features/admin/components/voucher-template-layout-editor";
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
  const cloneAction = cloneVoucherTemplateVersionAction.bind(null, templateId);
  const deleteAction = deleteVoucherTemplateDraftAction.bind(null, templateId);
  const previewUrl = template.previewStoragePath && template.masterSha256
    ? `/api/admin/voucher-templates/${template.id}/preview?v=${template.updatedAt.getTime()}`
    : undefined;

  return (
    <AdminPageShell eyebrow="Vouchery" title={template.label} description={`${template.key} · ${template.status}`}>
      <div className="space-y-5">
        <AdminVoucherTabs area="owner" active="templates" />
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-white/70">Master: {template.masterStoragePath ? "nahrán" : "chybí"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {template.status === "DRAFT" ? (
              <form action={uploadVoucherTemplateMasterAction} className="flex flex-wrap gap-3">
                <input type="hidden" name="templateId" value={template.id} />
                <input required name="master" type="file" accept="application/pdf,.pdf" />
                <button className="rounded-xl bg-[var(--color-accent)] px-4 py-2 font-semibold text-black">Nahrát PDF master</button>
              </form>
            ) : null}
            {template.status === "DRAFT" ? (
              <form action={publishVoucherTemplateAction.bind(null, template.id)}>
                <button className="rounded-xl border border-emerald-300/40 px-4 py-2 font-semibold text-emerald-100">Publikovat</button>
              </form>
            ) : null}
            {template.status === "PUBLISHED" ? (
              <DeactivateVoucherTemplateForm templateId={templateId} />
            ) : null}
            {template.status !== "DRAFT" ? (
              <form action={cloneAction}>
                <button className="rounded-xl border border-white/20 px-4 py-2 font-semibold text-white">Nová verze</button>
              </form>
            ) : null}
            {template.status === "DRAFT" ? (
              <form action={cloneAction}>
                <button className="rounded-xl border border-white/20 px-4 py-2 font-semibold text-white">Nová verze</button>
              </form>
            ) : null}
            {template.status === "DRAFT" ? (
              <form action={deleteAction}>
                <button className="rounded-xl border border-red-300/40 px-4 py-2 font-semibold text-red-100">Smazat draft</button>
              </form>
            ) : null}
          </div>
          {template.status === "DRAFT" ? (
            <form action={sendTestVoucherTemplateEmailAction} className="mt-4 flex flex-wrap gap-3">
              <input type="hidden" name="templateId" value={template.id} />
              <input required type="email" name="recipientEmail" placeholder="test@example.com" className="rounded-xl bg-black/25 px-3 py-2 text-sm" />
              <button className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white">Odeslat testovací e-mail</button>
            </form>
          ) : null}
        </section>
        {template.status === "DRAFT" ? <VoucherTemplateLayoutEditor templateId={template.id} initialLayout={voucherTemplateLayoutSchema.parse(template.layout)} previewSrc={previewUrl} /> : <pre className="overflow-auto rounded-lg bg-black/20 p-3 text-xs text-white/75">{JSON.stringify(template.layout, null, 2)}</pre>}
      </div>
    </AdminPageShell>
  );
}
