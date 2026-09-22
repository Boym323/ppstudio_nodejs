import { AdminRole } from "@/generated/prisma/client";
import { createVoucherTemplateAction } from "@/features/admin/actions/voucher-template-actions";
import { AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { AdminVoucherTabs } from "@/features/admin/components/admin-voucher-stock-pages";
import { requireRole } from "@/lib/auth/session";

export default async function NewVoucherTemplatePage() {
  await requireRole([AdminRole.OWNER]);

  return (
    <AdminPageShell eyebrow="Vouchery" title="Nová šablona" description="Vznikne nový draft; publikovaný design se nikdy nepřepisuje.">
      <div className="space-y-4">
        <AdminVoucherTabs area="owner" active="templates" />
        <form action={createVoucherTemplateAction} className="max-w-xl space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="block">Název<input required name="label" className="mt-1 w-full rounded-lg bg-black/20 p-2" /></label>
          <label className="block">Rodina (např. christmas)<input required name="familyKey" pattern="[A-Za-z0-9 -]+" className="mt-1 w-full rounded-lg bg-black/20 p-2" /></label>
          <button className="rounded-xl bg-[var(--color-accent)] px-4 py-2 font-semibold text-black">Vytvořit draft</button>
        </form>
      </div>
    </AdminPageShell>
  );
}
