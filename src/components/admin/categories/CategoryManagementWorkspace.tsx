"use client";

import { startTransition, useOptimistic, useState } from "react";

import {
  reorderServiceCategoryInlineAction,
  setServiceCategoryActiveAction,
} from "@/features/admin/actions/service-category-actions";

import { CategoryDetailDrawer } from "./CategoryDetailDrawer";
import { CategoryDetailPanel } from "./CategoryDetailPanel";
import { CategoryFilters } from "./CategoryFilters";
import { CategoryList } from "./CategoryList";
import { CategoryStats } from "./CategoryStats";
import {
  getCategoryWarnings,
  type CategoryFiltersState,
  type CategoryRecord,
  type CategoryStatsItem,
} from "./types";

type OptimisticAction =
  | {
      type: "toggle";
      categoryId: string;
      isActive: boolean;
    }
  | {
      type: "move";
      categoryId: string;
      direction: "up" | "down";
    }
  | {
      type: "save";
      category: {
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
      };
    };

function categoryReducer(state: CategoryRecord[], action: OptimisticAction) {
  switch (action.type) {
    case "toggle":
      return state.map((category) => {
        if (category.id !== action.categoryId) {
          return category;
        }

        const nextCategory = {
          ...category,
          isActive: action.isActive,
        };
        const warnings = getCategoryWarnings(nextCategory);

        return {
          ...nextCategory,
          warnings,
          problemCount: warnings.length,
        };
      });
    case "move": {
      const currentIndex = state.findIndex((category) => category.id === action.categoryId);

      if (currentIndex === -1) {
        return state;
      }

      const targetIndex = action.direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= state.length) {
        return state;
      }

      const reordered = [...state];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      return reordered.map((category, index) => ({
        ...category,
        sortOrder: (index + 1) * 10,
      }));
    }
    case "save":
      return state.map((category) => {
        if (category.id !== action.category.id) {
          return category;
        }

        const nextCategory = {
          ...category,
          name: action.category.name,
          publicName: action.category.publicName,
          description: action.category.description,
          pricingDescription: action.category.pricingDescription,
          pricingLayout: action.category.pricingLayout,
          pricingIconKey: action.category.pricingIconKey,
          sortOrder: action.category.sortOrder,
          pricingSortOrder: action.category.pricingSortOrder,
          isActive: action.category.isActive,
        };
        const warnings = getCategoryWarnings(nextCategory);

        return {
          ...nextCategory,
          warnings,
          problemCount: warnings.length,
        };
      });
    default:
      return state;
  }
}

export function CategoryManagementWorkspace({
  area,
  currentPath,
  servicesPath,
  stats,
  filters,
  categories,
  selectedCategory,
  selectedCategoryVisible,
  initialMode,
  initialMobileDetail,
}: {
  area: "owner" | "salon";
  currentPath: string;
  servicesPath: string;
  stats: CategoryStatsItem[];
  filters: CategoryFiltersState;
  categories: CategoryRecord[];
  selectedCategory: CategoryRecord | null;
  selectedCategoryVisible: boolean;
  initialMode: "list" | "create";
  initialMobileDetail: boolean;
}) {
  const [optimisticCategories, applyOptimistic] = useOptimistic(categories, categoryReducer);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    selectedCategory?.id ?? categories[0]?.id ?? null,
  );
  const [detailMode, setDetailMode] = useState<"create" | "edit">(initialMode === "create" ? "create" : "edit");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(initialMobileDetail);
  const [pendingMap, setPendingMap] = useState<Record<string, string | undefined>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedFromList = optimisticCategories.find((category) => category.id === selectedCategoryId) ?? null;
  const detailCategory =
    detailMode === "create"
      ? null
      : selectedFromList ??
        (selectedCategory && selectedCategory.id === selectedCategoryId ? selectedCategory : null);
  const returnTo = buildReturnTo(currentPath, filters);

  const handleSelect = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setDetailMode("edit");
    setMobileDrawerOpen(true);
  };

  const handleSaved = (category: {
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
  }) => {
    startTransition(() => {
      applyOptimistic({ type: "save", category });
    });
  };

  const runOptimisticAction = async (
    categoryId: string,
    actionName: string,
    optimisticAction: OptimisticAction,
    serverAction: () => Promise<{ ok: boolean }>,
  ) => {
    setActionError(null);
    setPendingMap((current) => ({ ...current, [categoryId]: actionName }));
    applyOptimistic(optimisticAction);

    startTransition(async () => {
      try {
        const result = await serverAction();

        if (!result.ok) {
          setActionError("Akci se nepodařilo dokončit. Zkuste ji prosím znovu.");
        }
      } catch {
        setActionError("Akci se nepodařilo dokončit. Zkuste ji prosím znovu.");
      } finally {
        setPendingMap((current) => {
          const next = { ...current };
          delete next[categoryId];
          return next;
        });
      }
    });
  };

  const handleToggleActive = (categoryId: string, isActive: boolean) => {
    void runOptimisticAction(
      categoryId,
      "toggle",
      { type: "toggle", categoryId, isActive },
      () => setServiceCategoryActiveAction({ area, categoryId, isActive }),
    );
  };

  const handleMove = (categoryId: string, direction: "up" | "down") => {
    void runOptimisticAction(
      categoryId,
      `move-${direction}`,
      { type: "move", categoryId, direction },
      () => reorderServiceCategoryInlineAction({ area, categoryId, direction }),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">Struktura katalogu</p>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/60">
            Přehled kategorií, warningů a navázaných služeb v rozložení, které zvládá rychlé denní úpravy bez zbytečných kliků.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDetailMode("create");
            setMobileDrawerOpen(true);
          }}
          className="inline-flex rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60"
        >
          + Nová kategorie
        </button>
      </div>

      <CategoryStats stats={stats} />

      <div className="space-y-4">
        <CategoryFilters
          currentPath={currentPath}
          filters={filters}
          selectedCategoryName={detailMode === "edit" ? detailCategory?.name : undefined}
        />

        {actionError ? (
          <div className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50">
            {actionError}
          </div>
        ) : null}

        {!selectedCategoryVisible && selectedCategory && detailMode === "edit" ? (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
            Vybraná kategorie není v aktuálním filtru. Detail zůstává otevřený, aby se rozpracovaná úprava neztratila.
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px] 2xl:grid-cols-[minmax(0,1.08fr)_480px]">
        <section className="space-y-4">
          <div className="grid gap-3 rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-4 text-sm text-white/66 sm:grid-cols-4">
            <p><span className="text-white">V seznamu:</span> {optimisticCategories.length}</p>
            <p><span className="text-white">Aktivní:</span> {optimisticCategories.filter((category) => category.isActive).length}</p>
            <p><span className="text-white">Prázdné:</span> {optimisticCategories.filter((category) => category.counts.total === 0).length}</p>
            <p><span className="text-white">S upozorněním:</span> {optimisticCategories.filter((category) => category.warnings.length > 0).length}</p>
          </div>

          <CategoryList
            categories={optimisticCategories}
            selectedCategoryId={detailMode === "edit" ? selectedCategoryId : undefined}
            servicesPath={servicesPath}
            pendingMap={pendingMap}
            onSelect={handleSelect}
            onToggleActive={handleToggleActive}
            onMove={handleMove}
          />
        </section>

        <div className="hidden xl:block">
          {detailMode === "create" ? (
            <CategoryDetailPanel
              mode="create"
              area={area}
              returnTo={returnTo}
              servicesPath={servicesPath}
            />
          ) : detailCategory ? (
            <CategoryDetailPanel
              mode="edit"
              area={area}
              returnTo={returnTo}
              servicesPath={servicesPath}
              category={detailCategory}
              isActionPending={Boolean(selectedCategoryId && pendingMap[selectedCategoryId])}
              onToggleActive={(nextValue) => handleToggleActive(detailCategory.id, nextValue)}
              onSaved={handleSaved}
              onDeactivate={() => handleToggleActive(detailCategory.id, false)}
            />
          ) : (
            <div className="rounded-[1.85rem] border border-dashed border-white/14 bg-white/[0.03] p-6 text-sm leading-6 text-white/60">
              Vyberte kategorii ze seznamu vlevo nebo založte novou.
            </div>
          )}
        </div>
      </div>

      <CategoryDetailDrawer
        open={mobileDrawerOpen}
        mode={detailMode}
        area={area}
        returnTo={returnTo}
        servicesPath={servicesPath}
        category={detailCategory}
        onClose={() => setMobileDrawerOpen(false)}
        onSaved={handleSaved}
        isActionPending={Boolean(selectedCategoryId && pendingMap[selectedCategoryId])}
        onToggleActive={
          detailCategory
            ? (nextValue) => handleToggleActive(detailCategory.id, nextValue)
            : undefined
        }
        onDeactivate={
          detailCategory
            ? () => handleToggleActive(detailCategory.id, false)
            : undefined
        }
      />
    </div>
  );
}

function buildReturnTo(currentPath: string, filters: CategoryFiltersState) {
  const params = new URLSearchParams();

  if (filters.query) {
    params.set("query", filters.query);
  }

  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.sort && filters.sort !== "order") {
    params.set("sort", filters.sort);
  }

  if (filters.flags.length > 0) {
    params.set("flags", filters.flags.join(","));
  }

  return params.size > 0 ? `${currentPath}?${params.toString()}` : currentPath;
}
