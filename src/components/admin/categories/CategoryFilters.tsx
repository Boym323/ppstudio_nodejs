"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import type { CategoryFiltersState } from "./types";

const chips = [
  { id: "empty", label: "Prázdné" },
  { id: "without-public", label: "Bez veřejné služby" },
  { id: "warning", label: "S upozorněním" },
] as const;

export function CategoryFilters({
  currentPath,
  filters,
  selectedCategoryName,
}: {
  currentPath: string;
  filters: CategoryFiltersState;
  selectedCategoryName?: string;
}) {
  const [selectedFlags, setSelectedFlags] = useState(filters.flags);

  const toggleFlag = (flag: (typeof chips)[number]["id"]) => {
    setSelectedFlags((current) =>
      current.includes(flag)
        ? current.filter((item) => item !== flag)
        : [...current, flag],
    );
  };

  return (
    <form
      method="get"
      action={currentPath}
      className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 shadow-[0_32px_80px_rgba(0,0,0,0.2)] lg:p-5"
    >
      {filters.categoryId ? <input type="hidden" name="categoryId" value={filters.categoryId} /> : null}
      <input type="hidden" name="flags" value={selectedFlags.join(",")} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_220px_220px_auto]">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.22em] text-white/45">Hledat kategorii</span>
          <input
            type="search"
            name="query"
            defaultValue={filters.query}
            placeholder="Název nebo poznámka"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[var(--color-accent)]/55 focus:bg-black/35"
          />
        </label>

        <SelectField name="status" label="Stav" defaultValue={filters.status}>
          <option value="all" className="text-black">Vše</option>
          <option value="active" className="text-black">Aktivní</option>
          <option value="inactive" className="text-black">Skryté</option>
        </SelectField>

        <SelectField name="sort" label="Řazení" defaultValue={filters.sort}>
          <option value="order" className="text-black">Pořadí</option>
          <option value="name" className="text-black">Název</option>
          <option value="services" className="text-black">Podle počtu služeb</option>
        </SelectField>

        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60"
          >
            Filtrovat
          </button>
          <a
            href={currentPath}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm text-white/78 transition hover:border-white/20 hover:bg-white/6"
          >
            Reset
          </a>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {chips.map((chip) => {
          const active = selectedFlags.includes(chip.id);

          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => toggleFlag(chip.id)}
              className={cn(
                "rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] transition",
                active
                  ? "border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.14)] text-[var(--color-accent-soft)]"
                  : "border-white/10 bg-black/15 text-white/62 hover:border-white/18 hover:text-white/84",
              )}
            >
              {chip.label}
            </button>
          );
        })}

        {selectedCategoryName ? (
          <p className="ml-auto text-sm text-white/58">
            Otevřeno: <span className="text-white">{selectedCategoryName}</span>
          </p>
        ) : null}
      </div>
    </form>
  );
}

function SelectField({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.22em] text-white/45">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/55 focus:bg-black/35"
      >
        {children}
      </select>
    </label>
  );
}
