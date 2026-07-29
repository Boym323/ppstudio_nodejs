import { type AdminArea } from "@/config/navigation";
import { getAdminPlannerWeek } from "@/features/admin/lib/admin-slots";
import { AdminWeeklyPlannerClient } from "./admin-weekly-planner-lab-client";
import styles from "./planner-lab.module.css";

export async function AdminWeeklyPlannerPage({ area, week, day, routeBase }: { area: AdminArea; week?: string; day?: string; routeBase: string }) {
  const data = await getAdminPlannerWeek(area, week);
  const initialDate = day && data.days.some((item) => item.dateKey === day) ? day : data.weekKey;

  return <section className={styles.page}><header className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3"><p className="text-[11px] uppercase tracking-[.28em] text-[var(--color-accent-soft)]">Týdenní plán</p><h2 className="text-xl font-semibold text-white">Volné termíny</h2></header><AdminWeeklyPlannerClient data={data} weekStart={data.weekKey} initialDate={initialDate} routeBase={routeBase} /></section>;
}
