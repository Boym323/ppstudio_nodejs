type AdminServicesToolbarProps = {
  currentPath: string;
  filters: {
    query: string;
    status: string;
    bookable: string;
    sort: string;
    serviceId?: string;
  };
  selectedServiceName?: string;
};

export function AdminServicesToolbar({
  currentPath,
  filters,
  selectedServiceName,
}: AdminServicesToolbarProps) {
  return (
    <form className="grid gap-3 rounded-[1.35rem] border border-white/8 bg-white/5 p-4 sm:grid-cols-2 xl:grid-cols-4">
      {filters.serviceId ? <input type="hidden" name="serviceId" value={filters.serviceId} /> : null}

      <label className="block sm:col-span-2 xl:col-span-1">
        <span className="text-xs uppercase tracking-[0.2em] text-white/50">Hledat</span>
        <input
          type="search"
          name="query"
          defaultValue={filters.query}
          placeholder="Název nebo kategorie"
          className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/60"
        />
      </label>

      <SelectField name="status" label="Stav" defaultValue={filters.status}>
        <option value="all" className="text-black">Vše</option>
        <option value="active" className="text-black">Aktivní</option>
        <option value="inactive" className="text-black">Neaktivní</option>
      </SelectField>

      <SelectField name="bookable" label="Rezervace" defaultValue={filters.bookable}>
        <option value="all" className="text-black">Vše</option>
        <option value="public" className="text-black">Veřejné</option>
        <option value="private" className="text-black">Jen interní</option>
      </SelectField>

      <SelectField name="sort" label="Řazení" defaultValue={filters.sort}>
        <option value="category" className="text-black">Kategorie</option>
        <option value="order" className="text-black">Pořadí</option>
        <option value="name" className="text-black">Název</option>
        <option value="duration" className="text-black">Délka</option>
        <option value="price" className="text-black">Cena</option>
      </SelectField>

      <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-4">
        {selectedServiceName ? (
          <p className="text-sm text-white/62">
            Vybráno: <span className="text-white">{selectedServiceName}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
          >
            Filtrovat
          </button>
          <a
            href={currentPath}
            className="rounded-full border border-white/10 px-5 py-3 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
          >
            Zrušit filtr
          </a>
        </div>
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
      <span className="text-xs uppercase tracking-[0.2em] text-white/50">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
      >
        {children}
      </select>
    </label>
  );
}
