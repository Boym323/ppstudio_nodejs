"use client";

import { CategoryRow } from "./CategoryRow";
import type { CategoryRecord } from "./types";

export function CategoryList({
  categories,
  selectedCategoryId,
  servicesPath,
  pendingMap,
  onSelect,
  onToggleActive,
  onMove,
}: {
  categories: CategoryRecord[];
  selectedCategoryId?: string | null;
  servicesPath: string;
  pendingMap: Record<string, string | undefined>;
  onSelect: (categoryId: string) => void;
  onToggleActive: (categoryId: string, nextValue: boolean) => void;
  onMove: (categoryId: string, direction: "up" | "down") => void;
}) {
  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/14 bg-white/[0.04] p-6">
        <p className="text-base font-medium text-white">Filtru zatím nic neodpovídá.</p>
        <p className="mt-2 text-sm leading-6 text-white/60">
          Zkuste jiný stav, hledání nebo vypnout některý z chip filtrů.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {categories.map((category, index) => (
        <CategoryRow
          key={category.id}
          category={category}
          isSelected={selectedCategoryId === category.id}
          servicesPath={servicesPath}
          isPending={Boolean(pendingMap[category.id])}
          canMoveUp={index > 0}
          canMoveDown={index < categories.length - 1}
          onOpen={() => onSelect(category.id)}
          onToggleActive={() => onToggleActive(category.id, !category.isActive)}
          onMove={(direction) => onMove(category.id, direction)}
        />
      ))}
    </div>
  );
}
