"use client";

import { useMemo, useState } from "react";

import { type KpiDashboardData } from "@/features/admin/types/kpi-dashboard";

const money = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("cs-CZ", { style: "percent", maximumFractionDigits: 1 });
const sorters = {
  revenue: (row: KpiDashboardData["services"][number]) => row.revenue,
  completed: (row: KpiDashboardData["services"][number]) => row.completed,
  averagePrice: (row: KpiDashboardData["services"][number]) => row.averagePrice,
  revenuePerHour: (row: KpiDashboardData["services"][number]) => row.revenuePerHour ?? -1,
};

export function KpiServicesTable({ services }: { services: KpiDashboardData["services"] }) {
  const [sort, setSort] = useState<keyof typeof sorters>("revenue");
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => [...services].sort((left, right) => sorters[sort](right) - sorters[sort](left)), [services, sort]);
  const visibleRows = showAll ? rows : rows.slice(0, 8);
  return <div>
    <label className="mb-3 flex items-center gap-2 text-sm text-white/70">Řadit podle <select value={sort} onChange={(event) => setSort(event.target.value as keyof typeof sorters)} className="min-h-11 rounded-xl border border-white/12 bg-black/30 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"><option value="revenue">Tržeb</option><option value="completed">Počtu návštěv</option><option value="averagePrice">Průměrné ceny</option><option value="revenuePerHour">Kč za hodinu</option></select></label>
    <div className="-mx-1 overflow-x-auto px-1 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]" tabIndex={0} aria-label="Nejvýdělečnější služby, tabulku lze posouvat vodorovně"><table className="min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-white/50"><tr>{["Služba", "Návštěvy", "Tržby", "Průměr", "Čas", "Kč/h", "Podíl"].map((header) => <th key={header} scope="col" className="whitespace-nowrap px-3 py-2">{header}</th>)}</tr></thead><tbody>{visibleRows.length ? visibleRows.map((row) => <tr key={row.name} className="border-t border-white/8 text-white/78"><th scope="row" className="min-w-44 px-3 py-3 text-left font-medium text-white">{row.name}</th><td className="whitespace-nowrap px-3 py-3">{number.format(row.completed)}</td><td className="whitespace-nowrap px-3 py-3">{money.format(row.revenue)}</td><td className="whitespace-nowrap px-3 py-3">{money.format(row.averagePrice)}</td><td className="whitespace-nowrap px-3 py-3">{number.format(row.reservedMinutes)} min</td><td className="whitespace-nowrap px-3 py-3">{row.revenuePerHour === null ? "—" : money.format(row.revenuePerHour)}</td><td className="whitespace-nowrap px-3 py-3">{percent.format(row.share / 100)}</td></tr>) : <tr><td colSpan={7} className="px-3 py-10 text-white/60">Zatím nejsou evidované žádné dokončené návštěvy.</td></tr>}</tbody></table></div>
    {rows.length > 8 ? <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-4 min-h-11 rounded-xl border border-white/12 px-4 text-sm text-white/80 transition hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">{showAll ? "Zobrazit méně" : `Zobrazit všech ${number.format(rows.length)} služeb`}</button> : null}
  </div>;
}
