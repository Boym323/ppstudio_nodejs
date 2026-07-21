import { type AdminArea } from "@/config/navigation";
import { getAdminPlannerWeek } from "@/features/admin/lib/admin-slots";
import { AdminWeeklyPlannerLabClient } from "./admin-weekly-planner-lab-client";
import styles from "./planner-lab.module.css";

export async function AdminWeeklyPlannerLabPage({ area, week, routeBase = "/admin/volne-terminy/lab" }: { area: AdminArea; week?: string; routeBase?: string }) {
  const data = await getAdminPlannerWeek(area, week);
  const isLab = routeBase.endsWith("/lab");

  return <section className={styles.page}><header className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3"><p className="text-[11px] uppercase tracking-[.28em] text-[var(--color-accent-soft)]">{isLab ? "Laboratoř FullCalendar v7" : "Týdenní plán"}</p><h2 className="text-xl font-semibold text-white">Volné termíny</h2></header><AdminWeeklyPlannerLabClient data={data} weekStart={data.weekKey} routeBase={routeBase} /></section>;
}
