import Form from "next/form";
import Link from "next/link";

import { bookingListSourceValues, bookingListStatusValues } from "@/features/admin/lib/admin-booking-list-validation";
import { type ReservationsDashboardData } from "@/features/admin/lib/admin-data";
import { cn } from "@/lib/utils";

import { AdminBookingSearchField } from "./admin-booking-search-field";

type AdminBookingsToolbarProps = {
  currentPath: string;
  filters: {
    query: string;
    status: (typeof bookingListStatusValues)[number];
    source: (typeof bookingListSourceValues)[number];
    dateFrom: string;
    dateTo: string;
    showPast: boolean;
    limits: ReservationsDashboardData["filters"]["limits"];
  };
  resultCount: number;
  stats: ReservationsDashboardData["stats"];
};

export function AdminBookingsToolbar({
  currentPath,
  filters,
  resultCount,
  stats,
}: AdminBookingsToolbarProps) {
  return (
    <Form
      action={currentPath}
      scroll={false}
      className="min-w-0 rounded-[1.2rem] border border-white/10 bg-[#151219]/95 px-3 py-3 backdrop-blur"
    >
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {stats.map((stat) => (
          <Link
            key={stat.key}
            href={stat.href}
            scroll={false}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/45 sm:min-h-9",
              stat.isActive
                ? "border-[var(--color-accent)]/52 bg-[rgba(190,160,120,0.18)] text-white shadow-[0_0_0_1px_rgba(190,160,120,0.18)]"
                : "border-white/10 bg-black/12 text-white/78 hover:border-white/18 hover:bg-white/6 hover:text-white",
            )}
          >
            <span className="font-medium">{stat.label}</span>
            <span className="ml-2 text-white/58">({stat.value})</span>
          </Link>
        ))}
      </div>

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_auto_auto] lg:gap-2">
        <AdminBookingSearchField defaultValue={filters.query} />

        <SelectField name="status" label="Stav" defaultValue={filters.status}>
          <option value="all" className="text-black">Vše</option>
          <option value="pending" className="text-black">Čeká</option>
          <option value="confirmed" className="text-black">Potvrzené</option>
          <option value="completed" className="text-black">Hotovo</option>
          <option value="cancelled" className="text-black">Zrušené</option>
          <option value="no_show" className="text-black">Nedorazila</option>
        </SelectField>

        <SelectField name="source" label="Kanál rezervace" defaultValue={filters.source}>
          <option value="all" className="text-black">Vše</option>
          <option value="web" className="text-black">Web</option>
          <option value="phone" className="text-black">Telefon</option>
          <option value="instagram" className="text-black">Instagram zpráva</option>
          <option value="in_person" className="text-black">Osobně</option>
          <option value="other" className="text-black">Ostatní</option>
        </SelectField>

        <DateField name="dateFrom" label="Od" defaultValue={filters.dateFrom} />
        <DateField name="dateTo" label="Do" defaultValue={filters.dateTo} />

        <div className="grid min-w-0 grid-cols-2 gap-2 lg:col-span-2 lg:flex lg:flex-wrap lg:items-end lg:justify-end">
          <button
            type="submit"
            className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-full border border-[var(--color-accent)]/45 bg-[var(--color-accent)]/16 px-4 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:bg-[var(--color-accent)]/24 lg:min-h-10"
          >
            Filtrovat
          </button>
          <a
            href={currentPath}
            className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-white/74 transition hover:border-white/18 hover:bg-white/6 hover:text-white lg:min-h-10"
          >
            Zrušit filtry
          </a>
        </div>
      </div>

      {filters.showPast ? <input type="hidden" name="showPast" value="1" /> : null}
      <input type="hidden" name="needsClosureLimit" value={String(filters.limits.needs_closure)} />
      <input type="hidden" name="pendingLimit" value={String(filters.limits.pending)} />
      <input type="hidden" name="upcomingLimit" value={String(filters.limits.upcoming)} />
      <input type="hidden" name="pastLimit" value={String(filters.limits.past)} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-2 text-sm text-white/58">
        <p>
          Výsledky: <span className="font-medium text-white">{resultCount}</span>
        </p>
        <p className="text-xs text-white/44">
          Rychlé filtry a detailní omezení drží jeden společný pracovní panel.
        </p>
      </div>
    </Form>
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
    <label className="block min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1.5 min-h-11 min-w-0 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60 lg:min-h-10"
      >
        {children}
      </select>
    </label>
  );
}

function DateField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
        {label}
      </span>
      <input
        type="date"
        name={name}
        defaultValue={defaultValue}
        className="mt-1.5 h-10 min-w-0 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
      />
    </label>
  );
}
