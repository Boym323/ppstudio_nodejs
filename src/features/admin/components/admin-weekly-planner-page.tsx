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
      <header className="rounded-[1.6rem] border border-white/10 bg-white/5 px-5 py-5 backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.35em] text-[var(--color-accent-soft)]">
              {area === "owner" ? "Volné termíny" : "Plán provozu"}
            </p>
            <h2 className="font-display text-4xl text-white lg:text-5xl">{data.title}</h2>
          </div>
          <div className="rounded-full border border-[var(--color-accent)]/35 bg-[rgba(190,160,120,0.12)] px-4 py-2 text-sm text-white/82">
            {data.weekRangeLabel}
          </div>
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-white/68">
          Kliknutí nebo tažení upraví běžnou dostupnost. Rezervace a chráněné časy zůstávají beze změny.
        </p>
      </header>

      <AdminWeeklyPlannerClient
        key={`${data.weekKey}-${initialDayKey}`}
        data={data}
        timeLabels={getPlannerTimeLabels()}
        initialDayKey={initialDayKey}
      />
    </section>
  );
}
