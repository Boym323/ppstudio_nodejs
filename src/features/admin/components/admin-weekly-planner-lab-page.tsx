import { type AdminArea } from "@/config/navigation";
import { getAdminPlannerWeek } from "@/features/admin/lib/admin-slots";
import { AdminWeeklyPlannerLabClient } from "./admin-weekly-planner-lab-client";
import styles from "./planner-lab.module.css";

export async function AdminWeeklyPlannerLabPage({ area, week }: { area: AdminArea; week?: string }) {
  const data = await getAdminPlannerWeek(area, week);
  return <section className={styles.page}><header className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-4 py-3"><p className="text-[11px] uppercase tracking-[.28em] text-[var(--color-accent-soft)]">Laboratoř FullCalendar v7</p><h2 className="text-xl font-semibold text-white">Volné termíny</h2></header><AdminWeeklyPlannerLabClient data={data} weekStart={data.weekKey} /></section>;
}
