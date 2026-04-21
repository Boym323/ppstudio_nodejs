import { cn } from "@/lib/utils";

import type { CategoryStatsItem } from "./types";

const toneStyles: Record<NonNullable<CategoryStatsItem["tone"]>, string> = {
  default: "text-white/88",
  accent: "text-white",
  muted: "text-white/82",
};

export function CategoryStats({ stats }: { stats: CategoryStatsItem[] }) {
  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] px-4 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {stats.map((stat) => (
        <article key={stat.label} className={cn("rounded-2xl px-4 py-3", toneStyles[stat.tone ?? "default"])}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-white/74">{stat.label}:</p>
            <p className="text-lg font-medium text-white">{stat.value}</p>
          </div>
        </article>
      ))}
      </div>
    </section>
  );
}
