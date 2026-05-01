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
      <header className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--color-accent-soft)]">
              {area === "owner" ? "Volné termíny" : "Plán provozu"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{data.title}</h2>
              <span
                className="inline-flex rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/60"
                title="Hlavní práce probíhá přímo v týdenní mřížce. Kliknutí vybírá blok, tažení upravuje dostupnost a rezervace zůstávají jen pro orientaci."
              >
                Kliknutí vybírá, tažení upravuje
              </span>
            </div>
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
