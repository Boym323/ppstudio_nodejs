import { type AdminArea } from "@/config/navigation";
import {
  getAdminPlannerWeek,
  getPlannerTimeLabels,
} from "@/features/admin/lib/admin-slots";

import { AdminWeeklyPlannerClient } from "./admin-weekly-planner-client";

type AdminWeeklyPlannerPageProps = {
  area: AdminArea;
  week?: string | null;
  day?: string | null;
};

export async function AdminWeeklyPlannerPage({ area, week, day }: AdminWeeklyPlannerPageProps) {
  const data = await getAdminPlannerWeek(area, week);
  const initialDayKey =
    data.days.find((item) => item.dateKey === day)?.dateKey ??
    data.days.find((item) => item.isToday)?.dateKey ??
    data.days[0]?.dateKey;

  return (
    <section className="space-y-4">
      <header className="rounded-[1.35rem] border border-white/8 bg-white/[0.04] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-accent-soft)]">
              {area === "owner" ? "Volné termíny" : "Plán provozu"}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{data.title}</h2>
            <p className="max-w-3xl text-sm leading-6 text-white/58">
              Hlavní práce probíhá přímo v týdenní mřížce. Kliknutí vybírá blok, tažení upravuje dostupnost a rezervace zůstávají jen pro orientaci.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-black/15 px-4 py-2 text-sm text-white/72">
            {data.weekRangeLabel}
          </div>
        </div>
      </header>

      <AdminWeeklyPlannerClient
        key={data.weekKey}
        data={data}
        timeLabels={getPlannerTimeLabels()}
        initialDayKey={initialDayKey}
      />
    </section>
  );
}
