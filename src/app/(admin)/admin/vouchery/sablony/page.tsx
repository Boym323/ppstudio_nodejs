import Link from "next/link";
import { AdminRole } from "@/generated/prisma/client";
import { AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { AdminVoucherTabs } from "@/features/admin/components/admin-voucher-stock-pages";
import { listOwnerVoucherTemplates } from "@/features/vouchers/lib/voucher-template-repository";
import { requireRole } from "@/lib/auth/session";

export default async function VoucherTemplatesPage() {
  await requireRole([AdminRole.OWNER]);
  const templates = await listOwnerVoucherTemplates();

  return (
    <AdminPageShell eyebrow="Vouchery" title="Šablony voucherů" description="Verzované PDF mastery a dynamický layout.">
      <div className="space-y-4">
        <AdminVoucherTabs area="owner" active="templates" />
        <div className="space-y-3">
          <Link className="inline-flex rounded-xl bg-[var(--color-accent)] px-4 py-2 font-semibold text-black" href="/admin/vouchery/sablony/nova">Nová šablona</Link>
          {templates.map((template) => <Link key={template.id} href={`/admin/vouchery/sablony/${template.id}`} className="block rounded-2xl border border-white/10 bg-white/5 p-4"><strong>{template.label}</strong><p className="mt-1 text-sm text-white/65">{template.key} · {template.status} · {template.allowedTypes.join(" + ")}</p></Link>)}
        </div>
      </div>
    </AdminPageShell>
  );
}
