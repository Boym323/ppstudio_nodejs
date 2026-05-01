type AdminServicesToolbarProps = {
  currentPath: string;
  filters: {
    query: string;
    status: string;
    bookable: string;
    sort: string;
    category?: string;
    serviceId?: string;
  };
  categories: Array<{
    id: string;
    name: string;
    isActive: boolean;
    _count: {
      services: number;
    };
  }>;
  selectedServiceName?: string;
};

export function AdminServicesToolbar({
  currentPath,
  filters,
  categories,
  selectedServiceName,
}: AdminServicesToolbarProps) {
  return (
    <form className="rounded-[1.1rem] border border-white/8 bg-[#161219]/95 p-3 backdrop-blur xl:sticky xl:top-3 xl:z-20">
        {filters.serviceId ? <input type="hidden" name="serviceId" value={filters.serviceId} /> : null}

        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-white/8 pb-3">
          <span className="rounded-full border border-[var(--color-accent)]/28 bg-[rgba(190,160,120,0.08)] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--color-accent-soft)]">
            Běžný katalog
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-white/66">
            Systémové skryté
          </span>
          <details className="group ml-auto">
            <summary className="cursor-pointer list-none text-xs text-white/58 transition hover:text-white/80 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">Legenda stavů</span>
              <span className="hidden group-open:inline">Skrýt legendu</span>
            </summary>
            <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-xs text-white/68">
              <LegendBadge label="Aktivní" title="Provozně zapnutá služba." tone="active" />
              <LegendBadge label="Neaktivní" title="Služba zůstává v evidenci, ale není provozně zapnutá." tone="muted" />
              <LegendBadge label="Veřejná" title="Klientka ji může vidět na webu a v rezervaci." tone="accent" />
              <LegendBadge label="Interní" title="Služba je jen pro interní práci nebo přípravu." tone="muted" />
            </div>
          </details>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,2.1fr)_repeat(4,minmax(0,1fr))]">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/46">Hledat</span>
            <input
              type="search"
              name="query"
              defaultValue={filters.query}
              placeholder="Název, kategorie nebo text"
              className="mt-1.5 w-full rounded-[0.95rem] border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/60"
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

          <SelectField name="category" label="Kategorie" defaultValue={filters.category ?? ""}>
            <option value="" className="text-black">Všechny</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id} className="text-black">
                {category.name}{category.isActive ? "" : " (neaktivní)"}
              </option>
            ))}
          </SelectField>

          <SelectField name="sort" label="Řazení" defaultValue={filters.sort}>
            <option value="category" className="text-black">Kategorie a pořadí</option>
            <option value="order" className="text-black">Pořadí</option>
            <option value="name" className="text-black">Název</option>
            <option value="duration" className="text-black">Délka</option>
            <option value="price" className="text-black">Cena</option>
          </SelectField>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-white/8 pt-3 sm:flex-row sm:items-center sm:justify-between">
          {selectedServiceName ? (
            <p className="text-sm text-white/62">
              Otevřená služba: <span className="text-white">{selectedServiceName}</span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
            >
              Filtrovat
            </button>
            <a
              href={currentPath}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
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
      <span className="text-[11px] uppercase tracking-[0.18em] text-white/46">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1.5 w-full rounded-[0.95rem] border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
      >
        {children}
      </select>
    </label>
  );
}

function LegendBadge({
  label,
  title,
  tone,
}: {
  label: string;
  title: string;
  tone: "active" | "accent" | "muted";
}) {
  const className =
    tone === "active"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-50"
      : tone === "accent"
        ? "border-[var(--color-accent)]/35 bg-[rgba(190,160,120,0.12)] text-[var(--color-accent-soft)]"
        : "border-white/10 bg-white/5 text-white/70";

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${className}`}
      title={title}
    >
      {label}
    </span>
  );
}
