"use client";

import * as Dialog from "@/components/ui/dialog";

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
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="z-[89] bg-black/62" />
        <Dialog.Content className="!inset-y-0 !right-0 !left-auto z-[90] !h-[100dvh] !max-h-none !w-full !max-w-4xl !translate-x-0 !translate-y-0 !overflow-hidden border-l border-white/10 bg-[#131116] shadow-[-20px_0_70px_rgba(0,0,0,0.45)]">
          <div className="flex h-full min-h-0 flex-col">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#131116]/96 px-5 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] backdrop-blur sm:px-6 sm:py-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent-soft)]">
                  Kategorie služeb
                </p>
                <Dialog.Title>{mode === "create" ? "Nová kategorie" : "Detail kategorie"}</Dialog.Title>
                <Dialog.Description>
                  Úpravy běží ve stejném pracovním kontextu, seznam kategorií zůstává v pozadí.
                </Dialog.Description>
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="min-h-11 min-w-11 rounded-full border border-white/10 px-3 py-2 text-sm text-white/74 transition hover:border-white/18 hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  Zavřít
                </button>
              </Dialog.Close>
            </header>

            <div className="flex min-h-0 flex-1 flex-col px-5 py-5 sm:px-6">
              {mode === "create" ? (
                <CategoryDetailPanel
                  mode="create"
                  area={area}
                  returnTo={returnTo}
                  servicesPath={servicesPath}
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
                  onSaved={onSaved}
                  onDeactivate={onDeactivate}
                />
              ) : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
