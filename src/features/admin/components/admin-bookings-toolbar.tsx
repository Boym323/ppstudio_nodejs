import Form from "next/form";

import { bookingListSourceValues, bookingListStatusValues } from "@/features/admin/lib/admin-booking-list-validation";

type AdminBookingsToolbarProps = {
  currentPath: string;
  filters: {
    query: string;
    status: (typeof bookingListStatusValues)[number];
    source: (typeof bookingListSourceValues)[number];
    dateFrom: string;
    dateTo: string;
  };
  resultCount: number;
};

export function AdminBookingsToolbar({
  currentPath,
  filters,
  resultCount,
}: AdminBookingsToolbarProps) {
  return (
    <Form
      action={currentPath}
      className="rounded-[1rem] border border-white/8 bg-[#151219]/95 px-3 py-2.5 backdrop-blur"
    >
      <div className="grid gap-2 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
            Hledat
          </span>
          <input
            type="search"
            name="query"
            defaultValue={filters.query}
            placeholder="Klientka, email, telefon, služba"
            className="mt-1.5 h-10 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[var(--color-accent)]/60"
          />
        </label>

        <SelectField name="status" label="Stav" defaultValue={filters.status}>
          <option value="all" className="text-black">Vše</option>
          <option value="pending" className="text-black">Čeká</option>
          <option value="confirmed" className="text-black">Potvrzené</option>
          <option value="completed" className="text-black">Hotovo</option>
          <option value="cancelled" className="text-black">Zrušené</option>
          <option value="no_show" className="text-black">Nedorazila</option>
        </SelectField>

        <SelectField name="source" label="Zdroj" defaultValue={filters.source}>
          <option value="all" className="text-black">Vše</option>
          <option value="web" className="text-black">Web</option>
          <option value="phone" className="text-black">Telefon</option>
          <option value="instagram" className="text-black">Instagram</option>
          <option value="in_person" className="text-black">Osobně</option>
          <option value="other" className="text-black">Ostatní</option>
        </SelectField>

        <DateField name="dateFrom" label="Od" defaultValue={filters.dateFrom} />
        <DateField name="dateTo" label="Do" defaultValue={filters.dateTo} />

        <div className="flex flex-wrap items-end gap-2 lg:justify-end">
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-full border border-[var(--color-accent)]/45 bg-[var(--color-accent)]/16 px-4 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:bg-[var(--color-accent)]/24"
          >
            Filtrovat
          </button>
          <a
            href={currentPath}
            className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm text-white/74 transition hover:border-white/18 hover:bg-white/6 hover:text-white"
          >
            Zrušit filtry
          </a>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-2 text-sm text-white/58">
        <p>
          Výsledky: <span className="font-medium text-white">{resultCount}</span>
        </p>
        <p className="text-xs text-white/44">
          Rychlý filtr bez změny booking logiky nebo detail workflow.
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
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1.5 h-10 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
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
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
        {label}
      </span>
      <input
        type="date"
        name={name}
        defaultValue={defaultValue}
        className="mt-1.5 h-10 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
      />
    </label>
  );
}
