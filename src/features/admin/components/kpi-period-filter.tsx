"use client";

import Link from "next/link";
import { useState } from "react";

import { type KpiPeriod } from "@/features/admin/types/kpi-dashboard";

const quickPeriods: Array<{ period: Exclude<KpiPeriod, "custom">; label: string }> = [
  { period: "next_month", label: "Příští měsíc" },
  { period: "this_month", label: "Tento měsíc" },
  { period: "last_month", label: "Minulý měsíc" },
  { period: "last_30_days", label: "Posledních 30 dní" },
  { period: "this_year", label: "Tento rok" },
];

export function KpiPeriodFilter({
  path,
  activePeriod,
  rangeLabel,
  initialFrom,
  initialTo,
}: {
  path: string;
  activePeriod: KpiPeriod;
  rangeLabel: string;
  initialFrom: string;
  initialTo: string;
}) {
  const [isCustomOpen, setCustomOpen] = useState(activePeriod === "custom");
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="flex snap-x gap-2 overflow-x-auto pb-1" aria-label="Výběr období">
        {quickPeriods.map(({ period, label }) => (
          <Link
            key={period}
            href={`${path}?period=${period}`}
            className={`min-h-11 shrink-0 snap-start rounded-xl border px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${activePeriod === period && !isCustomOpen ? "border-[var(--color-accent)] bg-[rgba(190,160,120,0.16)] text-white" : "border-white/12 text-white/70 hover:border-white/25"}`}
            aria-current={activePeriod === period && !isCustomOpen ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => { setCustomOpen(true); setError(null); }}
          className={`min-h-11 shrink-0 snap-start rounded-xl border px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${isCustomOpen ? "border-[var(--color-accent)] bg-[rgba(190,160,120,0.16)] text-white" : "border-white/12 text-white/70 hover:border-white/25"}`}
          aria-pressed={isCustomOpen}
        >
          Vlastní období
        </button>
      </div>

      {!isCustomOpen ? <p className="mt-3 text-sm text-white/65" aria-live="polite">Zobrazené období: {rangeLabel}</p> : null}

      {isCustomOpen ? (
        <form
          id="kpi-custom-period"
          action={path}
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            const values = new FormData(event.currentTarget);
            const from = String(values.get("dateFrom") ?? "");
            const to = String(values.get("dateTo") ?? "");
            if (!from || !to || from > to) {
              event.preventDefault();
              setError("Datum „Od“ musí být před datem „Do“ nebo stejné.");
            }
          }}
        >
          <input type="hidden" name="period" value="custom" />
          <label className="grid gap-1 text-xs text-white/65" htmlFor="kpi-date-from"><span>Od</span><input id="kpi-date-from" type="date" name="dateFrom" defaultValue={initialFrom} required className="min-h-11 rounded-xl border border-white/12 bg-black/30 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]" /></label>
          <label className="grid gap-1 text-xs text-white/65" htmlFor="kpi-date-to"><span>Do</span><input id="kpi-date-to" type="date" name="dateTo" defaultValue={initialTo} required className="min-h-11 rounded-xl border border-white/12 bg-black/30 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]" /></label>
          <button className="min-h-11 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Použít vlastní období</button>
          {error ? <p className="basis-full text-sm text-rose-300" role="alert">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
