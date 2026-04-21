"use client";

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
    publicName: string | null;
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
    <div className="fixed inset-0 z-40 bg-slate-950/72 backdrop-blur-sm xl:hidden">
      <div className="absolute inset-x-0 bottom-0 top-0 overflow-hidden px-4 py-4">
        <div className="mb-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/62">
          <p className="font-medium text-white">Mobilní detail</p>
          <p className="mt-1 leading-6">
            Akce zůstávají dole stále po ruce a obsah scrolluje nezávisle.
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
    </div>
  );
}
