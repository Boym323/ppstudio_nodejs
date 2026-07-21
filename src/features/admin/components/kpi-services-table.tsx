"use client";

import { useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { type KpiDashboardData } from "@/features/admin/types/kpi-dashboard";

const money = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("cs-CZ", { style: "percent", maximumFractionDigits: 1 });

type Service = KpiDashboardData["services"][number];
type SelectSort = "revenue" | "completed" | "averagePrice" | "revenuePerHour";

const selectSorts: Array<{ value: SelectSort; label: string }> = [
  { value: "revenue", label: "Tržeb" },
  { value: "completed", label: "Počtu návštěv" },
  { value: "averagePrice", label: "Průměrné ceny" },
  { value: "revenuePerHour", label: "Kč za hodinu" },
];

const columns: Array<ColumnDef<Service>> = [
  { accessorKey: "name", header: "Služba", enableSorting: false, cell: (info) => <span className="font-medium text-white">{info.getValue<string>()}</span> },
  { accessorKey: "completed", header: "Návštěvy", cell: (info) => number.format(info.getValue<number>()) },
  { accessorKey: "revenue", header: "Tržby", cell: (info) => money.format(info.getValue<number>()) },
  { accessorKey: "averagePrice", header: "Průměr", cell: (info) => money.format(info.getValue<number>()) },
  { accessorKey: "reservedMinutes", header: "Čas", enableSorting: false, cell: (info) => `${number.format(info.getValue<number>())} min` },
  {
    id: "revenuePerHour",
    header: "Kč/h",
    accessorFn: (row) => row.revenuePerHour ?? undefined,
    sortUndefined: "last",
    cell: (info) => {
      const value = info.row.original.revenuePerHour;
      return value === null ? "—" : money.format(value);
    },
  },
  { accessorKey: "share", header: "Podíl", enableSorting: false, cell: (info) => percent.format(info.getValue<number>() / 100) },
];

export function KpiServicesTable({ services }: { services: KpiDashboardData["services"] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "revenue", desc: true }]);
  const [showAll, setShowAll] = useState(false);
  const table = useReactTable({
    data: services,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    enableMultiSort: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const visibleRows = showAll ? rows : rows.slice(0, 8);
  const selectedSort = sorting[0]?.id;

  return <div>
    <label className="mb-3 flex items-center gap-2 text-sm text-white/70">Řadit podle <select value={selectedSort && selectSorts.some((sort) => sort.value === selectedSort) ? selectedSort : ""} onChange={(event) => setSorting([{ id: event.target.value as SelectSort, desc: true }])} className="min-h-11 rounded-xl border border-white/12 bg-black/30 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"><option value="" disabled>Vyberte řazení</option>{selectSorts.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}</select></label>
    <div className="-mx-1 overflow-x-auto px-1 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]" tabIndex={0} aria-label="Nejvýdělečnější služby, tabulku lze posouvat vodorovně"><table className="min-w-[720px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-white/50">{table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}>{headerGroup.headers.map((header) => {
      const canSort = header.column.getCanSort();
      const sortDirection = header.column.getIsSorted();
      return <th key={header.id} scope="col" aria-sort={sortDirection === "asc" ? "ascending" : sortDirection === "desc" ? "descending" : "none"} className="whitespace-nowrap px-3 py-2">{header.isPlaceholder ? null : canSort ? <button type="button" onClick={header.column.getToggleSortingHandler()} className="inline-flex min-h-8 items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">{flexRender(header.column.columnDef.header, header.getContext())}<span aria-hidden="true">{sortDirection === "asc" ? "↑" : sortDirection === "desc" ? "↓" : ""}</span></button> : flexRender(header.column.columnDef.header, header.getContext())}</th>;
    })}</tr>)}</thead><tbody>{visibleRows.length ? visibleRows.map((row) => <tr key={row.id} className="border-t border-white/8 text-white/78">{row.getVisibleCells().map((cell) => <td key={cell.id} className={`whitespace-nowrap px-3 py-3 ${cell.column.id === "name" ? "min-w-44" : ""}`}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>) : <tr><td colSpan={columns.length} className="px-3 py-10 text-white/60">Zatím nejsou evidované žádné dokončené návštěvy.</td></tr>}</tbody></table></div>
    {rows.length > 8 ? <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-4 min-h-11 rounded-xl border border-white/12 px-4 text-sm text-white/80 transition hover:border-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">{showAll ? "Zobrazit méně" : `Zobrazit všech ${number.format(rows.length)} služeb`}</button> : null}
  </div>;
}
