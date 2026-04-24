"use client";

import Link from "next/link";

import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import { cn } from "@/lib/utils";

import { getCategorySubtitle, type CategoryRecord } from "./types";

export function CategoryRow({
  category,
  isSelected,
  servicesPath,
  isPending,
  canMoveUp,
  canMoveDown,
  onOpen,
  onToggleActive,
  onMove,
}: {
  category: CategoryRecord;
  isSelected: boolean;
  servicesPath: string;
  isPending: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onOpen: () => void;
  onToggleActive: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const servicesHref = `${servicesPath}?category=${category.id}`;
  const hasWarning = category.warnings.length > 0;

  return (
    <article
      className={cn(
        "rounded-[1.45rem] border px-4 py-4 transition sm:px-5",
        isSelected
          ? "border-[var(--color-accent)]/55 bg-[rgba(190,160,120,0.085)] shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          : hasWarning
            ? "border-amber-300/22 bg-white/[0.03] hover:border-amber-300/35"
            : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]",
      )}
    >
      <div className="grid gap-4 xl:grid-cols-[28px_minmax(0,1.45fr)_56px_132px_112px_62px_auto] xl:items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.02] text-white/42">
          <GripIcon />
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
        >
          <h3 className={cn("text-[1.05rem] font-medium", hasWarning ? "text-[var(--color-accent-soft)]" : "text-white")}>
            {category.name}
          </h3>
          <p className="mt-1 max-w-[15rem] text-sm leading-6 text-white/58">{getCategorySubtitle(category)}</p>
          {category.warnings[0] ? (
            <p className="mt-2 text-sm leading-6 text-red-300/92">{category.warnings[0]}</p>
          ) : null}
        </button>

        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/30">Pořadí</p>
          <p className="mt-2 text-[1.05rem] font-medium text-white">{category.sortOrder}</p>
        </div>

        <div>
          <p className="text-sm leading-6 text-white/72">
            <span className="text-white">{category.counts.active} aktivní</span> / {category.counts.public} veřejné
            <br />
            / {category.counts.total} celkem
          </p>
        </div>

        <div className="flex justify-start">
          <AdminStatePill tone={category.isActive ? "active" : "muted"}>
            {category.isActive ? "Aktivní" : "Skrytá"}
          </AdminStatePill>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={category.isActive}
          aria-label={category.isActive ? "Deaktivovat kategorii" : "Aktivovat kategorii"}
          disabled={isPending}
          onClick={onToggleActive}
          className={cn(
            "inline-flex h-8 w-[52px] items-center rounded-full border px-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55 disabled:cursor-wait disabled:opacity-70",
            category.isActive
              ? "border-emerald-300/25 bg-emerald-400/16"
              : "border-white/10 bg-black/25",
          )}
        >
          <span
            className={cn(
              "h-6 w-6 rounded-full transition",
              category.isActive ? "translate-x-[20px] bg-emerald-200" : "translate-x-0 bg-white/70",
            )}
          />
        </button>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/16 text-white/80 transition hover:border-white/20 hover:bg-white/8"
            aria-label="Otevřít detail"
          >
            <OpenIcon />
          </button>
          <Link
            href={servicesHref}
            className="inline-flex h-10 items-center rounded-xl border border-white/10 px-4 text-sm text-white/78 transition hover:border-white/20 hover:bg-white/8"
          >
            Služby
          </Link>
          <div className="grid gap-2">
            <button
              type="button"
              disabled={!canMoveUp || isPending}
              onClick={() => onMove("up")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/16 text-white/80 transition hover:border-white/20 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Posunout nahoru"
            >
              <ArrowUpIcon />
            </button>
            <button
              type="button"
              disabled={!canMoveDown || isPending}
              onClick={() => onMove("down")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/16 text-white/80 transition hover:border-white/20 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Posunout dolů"
            >
              <ArrowDownIcon />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="4" cy="4" r="1.1" fill="currentColor" />
      <circle cx="10" cy="4" r="1.1" fill="currentColor" />
      <circle cx="4" cy="10" r="1.1" fill="currentColor" />
      <circle cx="10" cy="10" r="1.1" fill="currentColor" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M6 12L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7 6H12V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 13V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.5 8.5L9 5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M9 5v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.5 9.5L9 13l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
