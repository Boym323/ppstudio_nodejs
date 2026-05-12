import Link from "next/link";

import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  const lastIndex = items.length - 1;

  return (
    <nav aria-label="Drobečková navigace" className={cn("text-[13px] leading-6 text-stone-500", className)}>
      <ol className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {items.map((item, index) => {
          const isLast = index === lastIndex;

          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2.5">
              {isLast || !item.href ? (
                <span aria-current={isLast ? "page" : undefined} className="font-semibold text-stone-700">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="rounded-sm text-stone-500 underline-offset-4 transition-colors hover:text-stone-800 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                >
                  {item.label}
                </Link>
              )}
              {!isLast ? (
                <span aria-hidden="true" className="select-none text-stone-300">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
