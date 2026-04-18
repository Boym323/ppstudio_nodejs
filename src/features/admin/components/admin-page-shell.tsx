import Link from "next/link";

import { cn } from "@/lib/utils";

type StatItem = {
  label: string;
  value: string;
  tone?: "default" | "accent" | "muted";
  detail?: string;
};

type AdminPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  stats?: StatItem[];
  children?: React.ReactNode;
  compact?: boolean;
};

type AdminPanelProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  compact?: boolean;
};

type AdminKeyValueListProps = {
  items: Array<{
    id: string;
    title: string;
    meta?: string;
    description?: string;
    badge?: string;
    href?: string;
  }>;
  emptyTitle: string;
  emptyDescription: string;
};

const statToneStyles: Record<NonNullable<StatItem["tone"]>, string> = {
  default: "border-white/10 bg-black/10 text-white",
  accent: "border-[var(--color-accent)]/50 bg-[rgba(190,160,120,0.14)] text-white",
  muted: "border-white/8 bg-white/4 text-white/90",
};

export function AdminPageShell({
  eyebrow,
  title,
  description,
  stats,
  children,
  compact = false,
}: AdminPageShellProps) {
  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-panel)] border border-white/10 bg-white/6 p-7 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--color-accent-soft)]">
          {eyebrow}
        </p>
        <h2 className={cn("mt-4 font-display text-white", compact ? "text-4xl" : "text-5xl")}>
          {title}
        </h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-white/72">{description}</p>
      </section>

      {stats?.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className={cn(
                "rounded-[1.75rem] border p-5",
                statToneStyles[stat.tone ?? "default"],
              )}
            >
              <p className="text-xs uppercase tracking-[0.24em] text-white/55">{stat.label}</p>
              <p className="mt-4 font-display text-4xl">{stat.value}</p>
              {stat.detail ? (
                <p className="mt-3 text-sm leading-6 text-white/62">{stat.detail}</p>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {children}
    </div>
  );
}

export function AdminPanel({
  title,
  description,
  children,
  compact = false,
}: AdminPanelProps) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-panel)] border border-white/10 bg-black/10",
        compact ? "p-5" : "p-6",
      )}
    >
      <div className="border-b border-white/10 pb-4">
        <h3 className="font-display text-3xl text-white">{title}</h3>
        {description ? (
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/66">{description}</p>
        ) : null}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

export function AdminKeyValueList({
  items,
  emptyTitle,
  emptyDescription,
}: AdminKeyValueListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">{emptyTitle}</p>
        <p className="mt-2 text-sm leading-6 text-white/62">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div key={item.id}>
          {item.href ? (
            <Link
              href={item.href}
              className="group block rounded-[1.5rem] border border-white/8 bg-white/5 p-4 transition hover:border-white/18 hover:bg-white/7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-medium text-white transition group-hover:text-[var(--color-accent-soft)]">
                    {item.title}
                  </h4>
                  {item.meta ? (
                    <p className="mt-1 text-sm leading-6 text-white/58">{item.meta}</p>
                  ) : null}
                </div>
                {item.badge ? (
                  <span className="rounded-full border border-[var(--color-accent)]/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              {item.description ? (
                <p className="mt-3 text-sm leading-6 text-white/72">{item.description}</p>
              ) : null}
            </Link>
          ) : (
            <article className="rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-medium text-white">{item.title}</h4>
                  {item.meta ? (
                    <p className="mt-1 text-sm leading-6 text-white/58">{item.meta}</p>
                  ) : null}
                </div>
                {item.badge ? (
                  <span className="rounded-full border border-[var(--color-accent)]/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              {item.description ? (
                <p className="mt-3 text-sm leading-6 text-white/72">{item.description}</p>
              ) : null}
            </article>
          )}
        </div>
      ))}
    </div>
  );
}
