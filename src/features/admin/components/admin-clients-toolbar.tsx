type AdminClientsToolbarProps = {
  currentPath: string;
  filters: {
    query: string;
    status: string;
    sort: string;
    quick: string;
  };
};

export function AdminClientsToolbar({
  currentPath,
  filters,
}: AdminClientsToolbarProps) {
  const hasActiveFilters =
    filters.query.trim().length > 0
    || filters.status !== "all"
    || filters.sort !== "recent"
    || filters.quick !== "all";

  return (
    <div className="grid gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {quickFilters.map((quickFilter) => {
          const isActive = filters.quick === quickFilter.value;

          return (
            <a
              key={quickFilter.value}
              href={buildFilterHref(currentPath, filters, { quick: quickFilter.value })}
              className={[
                "inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition",
                isActive
                  ? "border-[var(--color-accent)]/60 bg-[rgba(190,160,120,0.16)] text-white"
                  : "border-white/10 bg-white/4 text-white/64 hover:border-white/18 hover:bg-white/7 hover:text-white/82",
              ].join(" ")}
            >
              {quickFilter.label}
            </a>
          );
        })}
      </div>

      <form className="grid gap-2 rounded-[1.1rem] border border-white/8 bg-white/5 p-3 lg:grid-cols-[minmax(220px,1fr)_150px_180px_auto_auto] lg:items-end">
        <input type="hidden" name="quick" value={filters.quick} />

        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-white/48">Hledat</span>
          <input
            type="search"
            name="query"
            defaultValue={filters.query}
            placeholder="Jméno, e-mail, telefon, poznámka"
            className="mt-1.5 w-full rounded-[0.85rem] border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/60"
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

        <button
          type="submit"
          className="h-10 rounded-full bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
        >
          Filtrovat
        </button>
        <div className="min-h-10">
          {hasActiveFilters ? (
            <a
              href={currentPath}
              className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
            >
              Zrušit filtr
            </a>
          ) : null}
        </div>
      </form>
    </div>
  );
}

const quickFilters = [
  { value: "all", label: "Vše" },
  { value: "with_booking", label: "S rezervací" },
  { value: "without_booking", label: "Bez rezervace" },
  { value: "no_contact", label: "Bez kontaktu" },
  { value: "noted", label: "S poznámkou" },
  { value: "new_30", label: "Nové za 30 dní" },
] as const;

function buildFilterHref(
  currentPath: string,
  filters: AdminClientsToolbarProps["filters"],
  nextFilters: Partial<AdminClientsToolbarProps["filters"]>,
) {
  const params = new URLSearchParams();
  const merged = {
    ...filters,
    ...nextFilters,
  };

  if (merged.query.trim().length > 0) {
    params.set("query", merged.query.trim());
  }

  if (merged.status !== "all") {
    params.set("status", merged.status);
  }

  if (merged.sort !== "recent") {
    params.set("sort", merged.sort);
  }

  if (merged.quick !== "all") {
    params.set("quick", merged.quick);
  }

  const query = params.toString();

  return query ? `${currentPath}?${query}` : currentPath;
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
        className="mt-1.5 h-10 w-full rounded-[0.85rem] border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
      >
        {children}
      </select>
    </label>
  );
}
