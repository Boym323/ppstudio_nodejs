import { cn } from "@/lib/utils";

import type { CategoryStatsItem } from "./types";

const toneStyles: Record<NonNullable<CategoryStatsItem["tone"]>, string> = {
  default: "border-white/10 bg-white/[0.045]",
  accent: "border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.12)]",
  muted: "border-white/8 bg-black/20",
};

export function CategoryStats({ stats }: { stats: CategoryStatsItem[] }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {stats.map((stat) => (
        <article
          key={stat.label}
          className={cn(
            "rounded-2xl border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.18)]",
            toneStyles[stat.tone ?? "default"],
          )}
        >
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/46">{stat.label}</p>
          <p className="mt-4 font-display text-3xl text-white sm:text-4xl">{stat.value}</p>
          <p className="mt-3 text-sm leading-6 text-white/64">{stat.detail}</p>
        </article>
      ))}
    </section>
  );
}
