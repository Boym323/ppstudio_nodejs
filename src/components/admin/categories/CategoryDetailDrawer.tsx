"use client";

import { AdminEscapeKeyClose } from "@/features/admin/components/admin-drawer-escape-close";

import { CategoryDetailPanel } from "./CategoryDetailPanel";
import type { CategoryRecord } from "./types";

export function CategoryDetailDrawer({
  open,
  area,
  returnTo,
  servicesPath,
  mode,
  category,
  onClose,
  onSaved,
  isActionPending,
  onToggleActive,
  onDeactivate,
}: {
  open: boolean;
  area: "owner" | "salon";
  returnTo: string;
  servicesPath: string;
  mode: "create" | "edit";
  category: CategoryRecord | null;
  onClose: () => void;
  onSaved?: (category: {
    id: string;
    name: string;
    description: string | null;
    pricingDescription: string | null;
    pricingLayout: "LIST" | "GRID";
    pricingIconKey: "DROPLET" | "EYE_LASHES" | "LOTUS" | "BRUSH" | "LEAF" | "LIPSTICK" | "SPARK";
    sortOrder: number;
    pricingSortOrder: number;
    isActive: boolean;
  }) => void;
  isActionPending?: boolean;
  onToggleActive?: (nextValue: boolean) => void;
  onDeactivate?: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <AdminEscapeKeyClose onEscape={onClose} />
      <div
        className="absolute inset-0 bg-black/62 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 w-full max-w-4xl overflow-hidden border-l border-white/10 bg-[#131116] shadow-[-20px_0_70px_rgba(0,0,0,0.45)]">
        <div className="flex h-full min-h-0 flex-col p-4 sm:p-5">
          <div className="mb-4 shrink-0 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/62">
            <p className="font-medium text-white">
              {mode === "create" ? "Nová kategorie" : "Detail kategorie"}
            </p>
            <p className="mt-1 leading-6">
              Úpravy běží ve stejném pracovním kontextu, seznam kategorií zůstává v pozadí.
            </p>
          </div>

          {mode === "create" ? (
            <CategoryDetailPanel
              mode="create"
              area={area}
              returnTo={returnTo}
              servicesPath={servicesPath}
              onClose={onClose}
            />
          ) : category ? (
            <CategoryDetailPanel
              mode="edit"
              area={area}
              returnTo={returnTo}
              servicesPath={servicesPath}
              category={category}
              isActionPending={isActionPending}
              onToggleActive={onToggleActive ?? (() => undefined)}
              onClose={onClose}
              onSaved={onSaved}
              onDeactivate={onDeactivate}
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}
