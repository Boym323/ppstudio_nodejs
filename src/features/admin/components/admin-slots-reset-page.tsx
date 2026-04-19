import Link from "next/link";

import { type AdminArea } from "@/config/navigation";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";

type AdminSlotsResetPageProps = {
  area: AdminArea;
  mode: "list" | "create" | "detail" | "edit";
  slotId?: string;
};

function getSlotRootHref(area: AdminArea) {
  return area === "owner" ? "/admin/volne-terminy" : "/admin/provoz/volne-terminy";
}

function getModeLabel(mode: AdminSlotsResetPageProps["mode"]) {
  switch (mode) {
    case "list":
      return "Přehled";
    case "create":
      return "Nový termín";
    case "detail":
      return "Detail termínu";
    case "edit":
      return "Úprava termínu";
  }
}

export function AdminSlotsResetPage({ area, mode, slotId }: AdminSlotsResetPageProps) {
  const rootHref = getSlotRootHref(area);

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Volné termíny" : "Plán provozu"}
      title="Sekce se připravuje od začátku"
      description="Plánování jsme vědomě vyčistili a necháváme jen čistý základ pro nový návrh. Staré workflow je dočasně vypnuté."
      compact={area === "salon"}
    >
      <AdminPanel
        title={getModeLabel(mode)}
        description="Tato obrazovka je záměrně minimalistická, aby další iterace začínala bez starého balastu."
        compact={area === "salon"}
      >
        <div className="space-y-4">
          <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-white/78">
            Aktivní kontext: {getModeLabel(mode)}
            {slotId ? ` • ID: ${slotId}` : ""}
          </div>

          <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/4 px-4 py-4 text-sm leading-6 text-white/68">
            Další krok je navrhnout nový planner bez kompromisů staré implementace.
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={rootHref}
              className="rounded-full border border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.14)] px-4 py-2 text-sm font-medium text-white"
            >
              Přehled sekce
            </Link>
            <Link
              href={`${rootHref}/novy`}
              className="rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white/85"
            >
              Nový termín
            </Link>
          </div>
        </div>
      </AdminPanel>
    </AdminPageShell>
  );
}
