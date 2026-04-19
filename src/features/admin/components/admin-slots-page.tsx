import Link from "next/link";
import { AvailabilitySlotStatus } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  AdminBatchCreateSlotForm,
  AdminQuickCreateSlotForm,
} from "@/features/admin/components/admin-slot-planner-forms";
import {
  getAdminSlotDetailHref,
  getAdminSlotPlannerHref,
  type AdminSlotPlannerData,
  type AdminSlotPlannerDay,
} from "@/features/admin/lib/admin-slots";

import { AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminSlotsPageProps = {
  area: AdminArea;
  data: AdminSlotPlannerData;
};

const dayToneClasses: Record<AdminSlotPlannerDay["stateTone"], string> = {
  empty: "border-white/12 bg-white/4 text-white/70",
  active: "border-emerald-300/30 bg-emerald-400/10 text-emerald-50",
  limited: "border-amber-300/30 bg-amber-400/10 text-amber-50",
  cancelled: "border-red-300/30 bg-red-400/10 text-red-50",
};

const slotToneClasses: Record<AvailabilitySlotStatus, string> = {
  DRAFT: "border-amber-300/30 bg-amber-400/10 text-amber-50",
  PUBLISHED: "border-emerald-300/40 bg-emerald-500/15 text-emerald-50",
  CANCELLED: "border-red-300/30 bg-red-400/10 text-red-50",
  ARCHIVED: "border-white/12 bg-white/5 text-white/66",
};

export function AdminSlotsPage({ area, data }: AdminSlotsPageProps) {
  const compact = area === "salon";
  const currentReturnTo = getAdminSlotPlannerHref(area, {
    week: data.filters.weekInput,
    day: data.selectedDay.dateKey,
    status: data.filters.statusInput,
  });

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Týdenní plánování dostupností" : "Týdenní plán salonu"}
      title={area === "owner" ? "Volné termíny po týdnech" : "Plán volných termínů"}
      description={
        area === "owner"
          ? "Týden je hlavní pracovní plocha. Dostupné sloty jsou zobrazené jako zelené bloky, takže je okamžitě vidět, kdy je salon otevřený pro rezervace a kde ještě chybí doplnit plán."
          : "Týdenní kalendář je postavený na zelených dostupných blocích. Provozní obsluha rychle vidí, kdy je den plný, prázdný nebo potřebuje doplnit další dostupnost."
      }
      stats={[
        { label: "Sloty v týdnu", value: String(data.stats.total), tone: "accent" },
        { label: "Publikované", value: String(data.stats.published) },
        { label: "Volné", value: String(data.stats.free) },
        { label: "Prázdné dny", value: String(data.stats.emptyDays), tone: "muted" },
      ]}
      compact={compact}
    >
      {data.filters.flash ? (
        <div
          className={
            data.filters.flash.tone === "error"
              ? "rounded-[1.25rem] border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50"
              : "rounded-[1.25rem] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50"
          }
        >
          {data.filters.flash.message}
        </div>
      ) : null}

      <AdminPanel
        title="Týdenní kalendář"
        description="Sedm sloupců ukazuje týden jako kalendář. Zelené bloky znamenají dostupné sloty a přidávání probíhá přes denní akce."
        compact={compact}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          {data.days.map((day) => {
            const dayHref = getAdminSlotPlannerHref(area, {
              week: data.filters.weekInput,
              day: day.dateKey,
              status: data.filters.statusInput,
            });

            return (
              <article
                key={day.dateKey}
                className={
                  day.dateKey === data.selectedDay.dateKey
                    ? "rounded-[1.5rem] border border-emerald-300/35 bg-[rgba(34,121,75,0.14)] p-4 shadow-[0_10px_26px_rgba(0,0,0,0.22)]"
                    : "rounded-[1.5rem] border border-white/10 bg-white/6 p-4 shadow-[0_10px_26px_rgba(0,0,0,0.16)]"
                }
              >
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/42">{day.weekdayShortLabel}</p>
                    <h3 className="mt-2 text-xl font-medium text-white">{day.headingLabel}</h3>
                    <p className="mt-2 text-xs leading-5 text-white/64">{day.availabilityWindowLabel}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${dayToneClasses[day.stateTone]}`}>
                    {day.stateLabel}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={getAdminSlotPlannerHref(area, {
                      week: data.filters.weekInput,
                      day: day.dateKey,
                      status: data.filters.statusInput,
                      panel: "create",
                    })}
                    className="rounded-full border border-emerald-300/40 bg-emerald-500/12 px-3 py-2 text-sm font-medium text-emerald-50"
                  >
                    Přidat slot
                  </Link>
                  <Link
                    href={getAdminSlotPlannerHref(area, {
                      week: data.filters.weekInput,
                      day: day.dateKey,
                      status: data.filters.statusInput,
                      panel: "batch",
                    })}
                    className="rounded-full border border-white/14 bg-white/5 px-3 py-2 text-sm font-medium text-white/82"
                  >
                    Přidat sérii
                  </Link>
                  <Link
                    href={dayHref}
                    className="rounded-full border border-white/14 bg-white/5 px-3 py-2 text-sm font-medium text-white/82"
                  >
                    Detail dne
                  </Link>
                </div>

                <div className="mt-4 min-h-[16rem] rounded-[1.25rem] border border-white/12 bg-black/12 p-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                    {day.slotCount > 0 ? "Dostupné bloky" : "Prázdný den"}
                  </p>

                  <div className="mt-3 grid gap-2">
                    {day.slots.length === 0 ? (
                      <div className="rounded-[1rem] border border-dashed border-emerald-300/25 bg-emerald-400/8 px-3 py-4 text-sm leading-6 text-emerald-50/82">
                        Den je zatím prázdný. Výchozí okno je {day.availabilityWindowLabel}.
                      </div>
                    ) : (
                      day.slots.map((slot) => (
                        <Link
                          key={slot.id}
                          href={getAdminSlotDetailHref(area, slot.id)}
                          className={`rounded-[1rem] border px-3 py-3 text-left transition hover:brightness-105 ${slotToneClasses[slot.status]}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-white">{slot.timeRangeLabel}</span>
                            <span className="text-[11px] text-white/58">{slot.statusLabel}</span>
                          </div>
                          {slot.allowedServiceNames.length > 0 ? (
                            <p className="mt-1 text-xs leading-5 text-white/62">{slot.allowedServiceNames.join(", ")}</p>
                          ) : null}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </AdminPanel>

      {data.filters.panelInput !== "day" ? (
        <AdminPanel
          title={data.filters.panelInput === "create" ? "Rychlé přidání slotu" : "Dávkové přidání slotů"}
          description={
            data.filters.panelInput === "create"
              ? `Vybraný den: ${data.selectedDay.headingLabel}. Tady přidáte jeden zelený blok rychle a bez zbytečných polí.`
              : `Vybraný den: ${data.selectedDay.headingLabel}. Série založí několik zelených bloků za sebou.`
          }
          compact={compact}
        >
          {data.filters.panelInput === "create" ? (
            <AdminQuickCreateSlotForm
              area={area}
              startsAtInput={data.selectedDay.suggestedStartsAtInput}
              endsAtInput={data.selectedDay.suggestedEndsAtInput}
              returnTo={currentReturnTo}
            />
          ) : (
            <AdminBatchCreateSlotForm
              area={area}
              day={data.selectedDay.dateKey}
              suggestedStartsAtInput={data.selectedDay.suggestedStartsAtInput}
              returnTo={currentReturnTo}
            />
          )}
        </AdminPanel>
      ) : null}
    </AdminPageShell>
  );
}
