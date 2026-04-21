import Link from "next/link";

import { type AdminArea } from "@/config/navigation";
import {
  moveServiceCategoryAction,
  toggleServiceCategoryActiveAction,
} from "@/features/admin/actions/service-category-actions";
import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import { cn } from "@/lib/utils";

type AdminServiceCategoriesListProps = {
  area: AdminArea;
  currentPath: string;
  servicesPath: string;
  currentCategoryId?: string;
  queryString: string;
  returnTo: string;
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
    warnings: string[];
    counts: {
      total: number;
      active: number;
      public: number;
    };
    _count: {
      services: number;
    };
  }>;
};

export function AdminServiceCategoriesList({
  area,
  currentPath,
  servicesPath,
  currentCategoryId,
  queryString,
  returnTo,
  categories,
}: AdminServiceCategoriesListProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">Filtru zatím nic neodpovídá.</p>
        <p className="mt-2 text-sm leading-6 text-white/62">
          Zkuste změnit hledání nebo přepnout stav kategorie.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {categories.map((category) => {
        const detailHref = `${currentPath}?${queryString}${queryString ? "&" : ""}categoryId=${category.id}`;
        const mobileDetailHref = `${detailHref}&mobileDetail=1`;
        const servicesHref = `${servicesPath}?category=${category.id}`;
        const isSelected = currentCategoryId === category.id;

        return (
          <article
            key={category.id}
            className={cn(
              "rounded-[1.4rem] border p-4 transition",
              isSelected
                ? "border-[var(--color-accent)]/50 bg-[rgba(190,160,120,0.12)]"
                : "border-white/8 bg-white/5",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-medium text-white sm:text-lg">{category.name}</h3>
                <p className="mt-1 text-sm leading-6 text-white/58">
                  {category.isActive ? "Viditelná pro katalog a booking flow." : "Vypnutá kategorie, která drží strukturu pro pozdější použití."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={detailHref}
                  className="hidden rounded-full border border-white/10 px-4 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6 xl:inline-flex"
                >
                  Otevřít detail
                </Link>
                <Link
                  href={mobileDetailHref}
                  className="inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6 xl:hidden"
                >
                  Detail
                </Link>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <AdminStatePill tone={category.isActive ? "active" : "muted"}>
                {category.isActive ? "Aktivní" : "Neaktivní"}
              </AdminStatePill>
              <AdminStatePill tone="accent">Pořadí #{category.sortOrder}</AdminStatePill>
              <AdminStatePill tone={category.counts.total > 0 ? "accent" : "muted"}>
                {category.counts.total > 0 ? `${category.counts.total} služeb` : "Prázdná"}
              </AdminStatePill>
              {category.warnings.length > 0 ? (
                <AdminStatePill tone="accent">
                  {category.warnings.length === 1 ? "1 upozornění" : `${category.warnings.length} upozornění`}
                </AdminStatePill>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 text-sm text-white/68 sm:grid-cols-3">
              <p><span className="text-white">Aktivní služby:</span> {category.counts.active}</p>
              <p><span className="text-white">Veřejné služby:</span> {category.counts.public}</p>
              <p><span className="text-white">Celkem:</span> {category.counts.total}</p>
            </div>

            {category.warnings.length > 0 ? (
              <div className="mt-3 rounded-[1.15rem] border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
                {category.warnings[0]}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <form action={toggleServiceCategoryActiveAction}>
                <input type="hidden" name="area" value={area} />
                <input type="hidden" name="categoryId" value={category.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button
                  type="submit"
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
                >
                  {category.isActive ? "Deaktivovat" : "Aktivovat"}
                </button>
              </form>

              <Link
                href={servicesHref}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
              >
                Zobrazit služby
              </Link>

              <MoveCategoryAction
                area={area}
                categoryId={category.id}
                direction="up"
                returnTo={returnTo}
              />
              <MoveCategoryAction
                area={area}
                categoryId={category.id}
                direction="down"
                returnTo={returnTo}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MoveCategoryAction({
  area,
  categoryId,
  direction,
  returnTo,
}: {
  area: AdminArea;
  categoryId: string;
  direction: "up" | "down";
  returnTo: string;
}) {
  return (
    <form action={moveServiceCategoryAction}>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
      >
        {direction === "up" ? "Posunout výš" : "Posunout níž"}
      </button>
    </form>
  );
}
