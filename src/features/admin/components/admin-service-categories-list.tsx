import Link from "next/link";

import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import { cn } from "@/lib/utils";

type AdminServiceCategoriesListProps = {
  currentPath: string;
  currentCategoryId?: string;
  queryString: string;
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
    _count: {
      services: number;
    };
  }>;
};

export function AdminServiceCategoriesList({
  currentPath,
  currentCategoryId,
  queryString,
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
        const href = `${currentPath}?${queryString}${queryString ? "&" : ""}categoryId=${category.id}`;
        const isSelected = currentCategoryId === category.id;

        return (
          <Link
            key={category.id}
            href={href}
            className={cn(
              "block rounded-[1.4rem] border p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
              isSelected
                ? "border-[var(--color-accent)]/50 bg-[rgba(190,160,120,0.12)]"
                : "border-white/8 bg-white/5 hover:border-white/16 hover:bg-white/7",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="mt-2 text-base font-medium text-white sm:text-lg">{category.name}</h3>
                <p className="mt-1 text-sm leading-6 text-white/58">
                  {category.isActive ? "Viditelná v nabídce a na webu." : "Skrytá z webu i z booking flow."}
                </p>
              </div>
              <AdminStatePill tone="accent">Pořadí {category.sortOrder}</AdminStatePill>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <AdminStatePill tone={category.isActive ? "active" : "muted"}>
                {category.isActive ? "Aktivní" : "Skrytá"}
              </AdminStatePill>
              <AdminStatePill tone={category._count.services > 0 ? "accent" : "muted"}>
                {category._count.services > 0 ? `${category._count.services} služeb` : "Prázdná"}
              </AdminStatePill>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
