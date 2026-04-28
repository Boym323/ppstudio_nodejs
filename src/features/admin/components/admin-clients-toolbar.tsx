type AdminClientsToolbarProps = {
  currentPath: string;
  filters: {
    query: string;
    status: string;
    sort: string;
  };
};

export function AdminClientsToolbar({
  currentPath,
  filters,
}: AdminClientsToolbarProps) {
  const hasActiveFilters =
    filters.query.trim().length > 0 || filters.status !== "all" || filters.sort !== "recent";

  return (
    <form className="grid gap-2 rounded-[1.2rem] border border-white/8 bg-white/5 p-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="block sm:col-span-2 xl:col-span-1">
        <span className="text-[11px] uppercase tracking-[0.18em] text-white/48">Hledat</span>
        <input
          type="search"
          name="query"
          defaultValue={filters.query}
          placeholder="Jméno, e-mail, telefon, poznámka"
          className="mt-1.5 w-full rounded-[0.95rem] border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/60"
        />
      </label>

      <SelectField name="status" label="Stav" defaultValue={filters.status}>
        <option value="all" className="text-black">Vše</option>
        <option value="active" className="text-black">Aktivní</option>
        <option value="inactive" className="text-black">Neaktivní</option>
      </SelectField>

      <SelectField name="sort" label="Řazení" defaultValue={filters.sort}>
        <option value="recent" className="text-black">Poslední návštěva</option>
        <option value="bookings" className="text-black">Počet rezervací</option>
        <option value="name" className="text-black">Jméno</option>
        <option value="created" className="text-black">Nově přidané</option>
      </SelectField>

      <div className="flex flex-wrap items-center gap-2 sm:col-span-2 xl:col-span-3">
        <button
          type="submit"
          className="rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
        >
          Filtrovat
        </button>
        {hasActiveFilters ? (
          <a
            href={currentPath}
            className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
          >
            Zrušit filtr
          </a>
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
      <span className="text-[11px] uppercase tracking-[0.18em] text-white/48">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1.5 w-full rounded-[0.95rem] border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
      >
        {children}
      </select>
    </label>
  );
}
