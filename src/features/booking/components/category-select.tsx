"use client";

import { cn } from "@/lib/utils";

type CategorySelectProps = {
  categories: Array<{
    key: string;
    label: string;
    serviceCount: number;
  }>;
  selectedKey: string;
  onSelect: (categoryKey: string) => void;
};

export function CategorySelect({
  categories,
  selectedKey,
  onSelect,
}: CategorySelectProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {categories.map((category) => {
        const isSelected = category.key === selectedKey;

        return (
          <button
            key={category.key}
            type="button"
            onClick={() => onSelect(category.key)}
            aria-pressed={isSelected}
            className={cn(
              "rounded-3xl border px-5 py-4 text-left transition-all duration-150",
              isSelected
                ? "border-[var(--color-accent)] bg-[var(--color-surface-strong)]/45 shadow-[0_8px_20px_rgba(0,0,0,0.06)]"
                : "border-black/6 bg-[var(--color-surface)]/25 hover:border-black/10 hover:bg-[var(--color-surface)]/45",
            )}
          >
            <p className="text-sm font-semibold text-[var(--color-foreground)]">{category.label}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              {category.serviceCount} {category.serviceCount === 1 ? "služba" : category.serviceCount < 5 ? "služby" : "služeb"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
