import Link from "next/link";

import { cn } from "@/lib/utils";

type StatItem = {
  label: string;
  value: string;
  tone?: "default" | "accent" | "muted";
  detail?: string;
};

type AdminPageShellProps = {
  eyebrow?: string;
  title: string;
  description: string;
  headerActions?: React.ReactNode;
  stats?: StatItem[];
  compactStats?: boolean;
  slimStats?: boolean;
  children?: React.ReactNode;
  compact?: boolean;
  denseIntro?: boolean;
};

type AdminPanelProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  compact?: boolean;
  denseHeader?: boolean;
  tighter?: boolean;
  className?: string;
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
  headerActions,
  stats,
  compactStats = false,
  slimStats = false,
  children,
  compact = false,
  denseIntro = false,
}: AdminPageShellProps) {
  return (
    <div className={cn("min-w-0", denseIntro ? "space-y-4" : "space-y-6")}>
      <section
        className={cn(
          "rounded-[var(--radius-panel)] border border-white/10 bg-white/6 backdrop-blur-xl",
          denseIntro ? "px-4 py-3 sm:px-5 sm:py-3.5" : "p-5 sm:p-7",
        )}
      >
        <div className={cn("flex gap-4", denseIntro ? "items-center justify-between" : "flex-col")}>
          <div className="min-w-0">
            {eyebrow ? (
              <p
                className={cn(
                  "text-xs uppercase text-[var(--color-accent-soft)]",
                  denseIntro ? "tracking-[0.28em]" : "tracking-[0.35em]",
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            <h2
              className={cn(
                "font-display text-white",
                denseIntro
                  ? "text-[1.55rem] leading-none sm:text-[1.7rem]"
                  : compact
                    ? "mt-4 text-3xl sm:text-4xl"
                    : "mt-4 text-3xl sm:text-4xl xl:text-5xl",
              )}
            >
              {title}
            </h2>
            <p
              className={cn(
                "max-w-3xl text-white/72",
                denseIntro
                  ? cn(eyebrow ? "mt-1.5" : "mt-1", "text-sm leading-5")
                  : "mt-4 text-sm leading-7 sm:text-base",
              )}
            >
              {description}
            </p>
          </div>

          {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
        </div>
      </section>

      {stats?.length ? (
        <section
          className={cn(
            "grid md:grid-cols-2 xl:grid-cols-4",
            compactStats ? (slimStats ? "gap-2.5" : "gap-3") : "gap-4",
          )}
        >
          {stats.map((stat) => (
            <article
              key={stat.label}
              className={cn(
                compactStats
                  ? slimStats
                    ? "rounded-[1.1rem] border px-4 py-2.5"
                    : "rounded-[1.2rem] border px-4 py-3.5"
                  : "rounded-[1.75rem] border p-5",
                statToneStyles[stat.tone ?? "default"],
              )}
            >
              <p className={cn("uppercase tracking-[0.24em] text-white/55", slimStats ? "text-[10px]" : "text-xs")}>
                {stat.label}
              </p>
              <p
                className={cn(
                  "break-words font-display",
                  compactStats
                    ? slimStats
                      ? "mt-1 text-[1.45rem] leading-none sm:text-[1.7rem]"
                      : "mt-1.5 text-[1.75rem] sm:text-[2rem]"
                    : "mt-4 text-3xl sm:text-4xl",
                )}
              >
                {stat.value}
              </p>
              {stat.detail ? (
                <p
                  className={cn(
                    "text-white/62",
                    compactStats
                      ? slimStats
                        ? "mt-1 text-[11px] leading-4"
                        : "mt-1.5 text-sm leading-5"
                      : "mt-3 text-sm leading-6",
                  )}
                >
                  {stat.detail}
                </p>
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
  denseHeader = false,
  tighter = false,
  className,
}: AdminPanelProps) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-panel)] border border-white/10 bg-black/10",
        tighter ? "p-4 sm:p-4.5" : compact ? "p-5" : "p-6",
        className,
      )}
    >
      <div className={cn("border-b border-white/10", tighter ? "pb-2.5" : denseHeader ? "pb-3" : "pb-4")}>
        <h3
          className={cn(
            "font-display text-white",
            tighter ? "text-[1.2rem] sm:text-[1.3rem]" : denseHeader ? "text-[1.4rem] sm:text-[1.55rem]" : "text-2xl sm:text-3xl",
          )}
        >
          {title}
        </h3>
        {description ? (
          <p
            className={cn(
              "max-w-3xl text-sm text-white/66",
              tighter ? "mt-1.5 leading-5" : denseHeader ? "mt-2 leading-5" : "mt-3 leading-6",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className={tighter ? "pt-2.5" : denseHeader ? "pt-3" : "pt-4"}>{children}</div>
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
