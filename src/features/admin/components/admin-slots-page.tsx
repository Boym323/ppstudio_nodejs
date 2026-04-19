import Link from "next/link";
import { AvailabilitySlotStatus } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  changeSlotStatusAction,
  deleteSlotAction,
} from "@/features/admin/actions/slot-actions";
import {
  AdminBatchCreateSlotForm,
  AdminQuickCreateSlotForm,
  AdminSlotQuickEditForm,
} from "@/features/admin/components/admin-slot-planner-forms";
import {
  getAdminSlotDetailHref,
  getAdminSlotEditHref,
  getAdminSlotListHref,
  getAdminSlotPlannerHref,
  getAdminSlotStatusLabel,
  type AdminSlotPlannerData,
  type AdminSlotPlannerDay,
  type AdminSlotPlannerSlot,
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

export function AdminSlotsPage({ area, data }: AdminSlotsPageProps) {
  const compact = area === "salon";
  const baseHref = getAdminSlotListHref(area);
  const previousWeek = shiftWeek(data.filters.weekInput, -7);
  const nextWeek = shiftWeek(data.filters.weekInput, 7);
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
          ? "Hlavní pracovní plocha je vždy celý týden. Z jednoho místa rychle poznáte prázdné dny, přidáte sloty a otevřete detail dne jen tam, kde je potřeba jemnější práce."
          : "Týden je hlavní pracovní přehled pro každodenní provoz. Dny jsou rychle čitelné, přidání slotu je po ruce a detail dne slouží pro bezpečné doladění."
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
        title="Týdenní přehled"
        description="Přepínání mezi týdny a filtr stavu držíme nahoře, aby samotný týdenní plán zůstal hlavní pracovní plochou."
        compact={compact}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={getAdminSlotPlannerHref(area, {
                week: previousWeek,
                day: previousWeek,
                status: data.filters.statusInput,
              })}
              className="rounded-full border border-white/14 bg-white/5 px-4 py-3 text-sm font-medium text-white/82 transition hover:border-white/24 hover:text-white"
            >
              Předchozí týden
            </Link>
            <div className="rounded-[1.2rem] border border-white/10 bg-white/5 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/45">Aktuální týden</p>
              <p className="mt-2 font-display text-2xl text-white">{data.weekLabel}</p>
            </div>
            <Link
              href={getAdminSlotPlannerHref(area, {
                week: nextWeek,
                day: nextWeek,
                status: data.filters.statusInput,
              })}
              className="rounded-full border border-white/14 bg-white/5 px-4 py-3 text-sm font-medium text-white/82 transition hover:border-white/24 hover:text-white"
            >
              Další týden
            </Link>
          </div>

          <form action={baseHref} className="grid gap-4 md:grid-cols-[180px_220px_auto] xl:min-w-[580px]">
            <label className="block">
              <span className="text-sm font-medium text-white">Týden od</span>
              <input
                type="date"
                name="week"
                defaultValue={data.filters.weekInput}
                className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Filtrovat sloty</span>
              <select
                name="status"
                defaultValue={data.filters.statusInput}
                className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
              >
                <option value="ALL" className="text-black">
                  Všechny stavy
                </option>
                {Object.values(AvailabilitySlotStatus).map((status) => (
                  <option key={status} value={status} className="text-black">
                    {getAdminSlotStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-3">
              <button
                type="submit"
                className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
              >
                Zobrazit týden
              </button>
              <Link href={baseHref} className="text-sm text-[var(--color-accent-soft)] transition hover:text-white">
                Reset
              </Link>
            </div>
          </form>
        </div>
      </AdminPanel>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.6fr)_420px]">
        <AdminPanel
          title="Dny v týdnu"
          description="Každý den ukazuje počet slotů, rozložení času a rychlé vstupy do přidání, série i detailu dne. Na mobilu se řadí pod sebe, na desktopu tvoří týdenní grid."
          compact={compact}
        >
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-7">
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
                      ? "rounded-[1.5rem] border border-[var(--color-accent)]/40 bg-[rgba(190,160,120,0.09)] p-4"
                      : "rounded-[1.5rem] border border-white/8 bg-white/5 p-4"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/45">{day.weekdayLabel}</p>
                      <h3 className="mt-2 text-lg font-medium text-white">{day.headingLabel}</h3>
                      <p className="mt-1 text-sm leading-6 text-white/62">{day.timeRangeLabel}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${dayToneClasses[day.stateTone]}`}>
                      {day.stateLabel}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-white/74">
                    <DayStat label="Sloty" value={String(day.slotCount)} />
                    <DayStat label="Volné" value={String(day.freeCount)} />
                    <DayStat label="Publikované" value={String(day.publishedCount)} />
                    <DayStat label="Plné" value={String(day.occupiedCount)} />
                  </div>

                  <p className="mt-4 min-h-[3.5rem] text-sm leading-6 text-white/68">{day.summaryLabel}</p>

                  <div className="mt-4 grid gap-2">
                    {day.slots.length === 0 ? (
                      <div className="rounded-[1rem] border border-dashed border-white/14 bg-black/10 px-3 py-4 text-sm leading-6 text-white/58">
                        Den je zatím prázdný.
                      </div>
                    ) : (
                      <>
                        {day.slots.slice(0, 4).map((slot) => (
                          <Link
                            key={slot.id}
                            href={dayHref}
                            className="rounded-[1rem] border border-white/8 bg-black/10 px-3 py-3 text-left transition hover:border-white/18 hover:bg-white/8"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-white">{slot.timeRangeLabel}</span>
                              <span className="text-xs text-white/58">{slot.activeBookingsCount}/{slot.capacity}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-white/56">{slot.statusLabel} • {slot.occupancyLabel}</p>
                          </Link>
                        ))}
                        {day.slots.length > 4 ? (
                          <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                            + {day.slots.length - 4} další sloty
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={getAdminSlotPlannerHref(area, {
                        week: data.filters.weekInput,
                        day: day.dateKey,
                        status: data.filters.statusInput,
                        panel: "create",
                      })}
                      className="rounded-full border border-[var(--color-accent)]/40 bg-[rgba(190,160,120,0.14)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[rgba(190,160,120,0.22)]"
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
                      className="rounded-full border border-white/14 bg-white/5 px-3 py-2 text-sm font-medium text-white/82 transition hover:border-white/24 hover:text-white"
                    >
                      Přidat sérii
                    </Link>
                    <Link
                      href={dayHref}
                      className="rounded-full border border-white/14 bg-white/5 px-3 py-2 text-sm font-medium text-white/82 transition hover:border-white/24 hover:text-white"
                    >
                      Detail dne
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </AdminPanel>

        <div className="space-y-6 2xl:sticky 2xl:top-6 self-start">
          <AdminPanel
            title={`Den: ${data.selectedDay.headingLabel}`}
            description="Sekundární vrstva pro jemnější práci. Tady můžete přidávat nové sloty, zakládat sérii a u existujících položek rychle měnit stav nebo čas."
            compact={compact}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${dayToneClasses[data.selectedDay.stateTone]}`}>
                {data.selectedDay.stateLabel}
              </span>
              <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs text-white/70">
                {data.selectedDay.slotCount} slotů
              </span>
              <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs text-white/70">
                {data.selectedDay.freeCount} volných
              </span>
              <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs text-white/70">
                {data.selectedDay.occupiedCount} plných
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <PanelLink
                href={getAdminSlotPlannerHref(area, {
                  week: data.filters.weekInput,
                  day: data.selectedDay.dateKey,
                  status: data.filters.statusInput,
                })}
                active={data.filters.panelInput === "day"}
                label="Přehled dne"
              />
              <PanelLink
                href={getAdminSlotPlannerHref(area, {
                  week: data.filters.weekInput,
                  day: data.selectedDay.dateKey,
                  status: data.filters.statusInput,
                  panel: "create",
                })}
                active={data.filters.panelInput === "create"}
                label="Jeden slot"
              />
              <PanelLink
                href={getAdminSlotPlannerHref(area, {
                  week: data.filters.weekInput,
                  day: data.selectedDay.dateKey,
                  status: data.filters.statusInput,
                  panel: "batch",
                })}
                active={data.filters.panelInput === "batch"}
                label="Více slotů"
              />
            </div>

            <div className="mt-5">
              {data.filters.panelInput === "create" ? (
                <div id="day-panel-create" className="space-y-3">
                  <SectionIntro
                    title="Rychlé přidání jednoho slotu"
                    description="Nejkratší cesta pro běžný provoz. Pokud pak potřebujete omezení služeb nebo poznámky, doplníte je u konkrétního slotu."
                  />
                  <AdminQuickCreateSlotForm
                    area={area}
                    startsAtInput={data.selectedDay.suggestedStartsAtInput}
                    endsAtInput={data.selectedDay.suggestedEndsAtInput}
                    returnTo={currentReturnTo}
                  />
                </div>
              ) : data.filters.panelInput === "batch" ? (
                <div id="day-panel-batch" className="space-y-3">
                  <SectionIntro
                    title="Dávkové přidání více slotů"
                    description="Vhodné pro rychlé rozplánování dne. Server sérii zastaví, pokud by vznikla kolize nebo by přesáhla do dalšího dne."
                  />
                  <AdminBatchCreateSlotForm
                    area={area}
                    day={data.selectedDay.dateKey}
                    suggestedStartsAtInput={data.selectedDay.suggestedStartsAtInput}
                    returnTo={currentReturnTo}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <SectionIntro
                    title="Detail dne"
                    description="Tady se pracuje s konkrétními sloty. Odtud je nejrychlejší změna stavu, rychlá úprava času a přechod do plné editace pro služby a poznámky."
                  />

                  {data.selectedDay.slots.length === 0 ? (
                    <div className="rounded-[1.1rem] border border-dashed border-white/14 bg-white/4 px-4 py-5 text-sm leading-6 text-white/66">
                      Vybraný den je zatím bez slotů. Použijte nahoře akci pro přidání jednoho slotu nebo celé série.
                    </div>
                  ) : (
                    data.selectedDay.slots.map((slot) => (
                      <DaySlotCard
                        key={slot.id}
                        area={area}
                        slot={slot}
                        returnTo={currentReturnTo}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </AdminPanel>

          <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-white/66 lg:hidden">
            <p className="font-medium text-white">Rychlé mobilní akce</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="#day-panel-create" className="rounded-full border border-[var(--color-accent)]/40 bg-[rgba(190,160,120,0.14)] px-3 py-2 text-sm font-medium text-white">
                Přidat slot
              </a>
              <a href="#day-panel-batch" className="rounded-full border border-white/14 bg-white/5 px-3 py-2 text-sm font-medium text-white/82">
                Přidat sérii
              </a>
            </div>
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}

function DaySlotCard({
  area,
  slot,
  returnTo,
}: {
  area: AdminArea;
  slot: AdminSlotPlannerSlot;
  returnTo: string;
}) {
  const primaryStatusAction =
    slot.status === AvailabilitySlotStatus.PUBLISHED
      ? { label: "Stáhnout do draftu", nextStatus: AvailabilitySlotStatus.DRAFT }
      : { label: "Publikovat", nextStatus: AvailabilitySlotStatus.PUBLISHED };

  return (
    <article className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-medium text-white">{slot.timeRangeLabel}</h4>
            <span className="rounded-full border border-white/12 bg-black/15 px-3 py-1 text-xs text-white/68">
              {slot.statusLabel}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/62">
            {slot.occupancyLabel} • {slot.activeBookingsCount}/{slot.capacity} obsazeno • {slot.restrictionLabel}
          </p>
        </div>
        <Link
          href={getAdminSlotDetailHref(area, slot.id)}
          className="text-sm text-[var(--color-accent-soft)] transition hover:text-white"
        >
          Detail slotu
        </Link>
      </div>

      <div className="mt-4 grid gap-2">
        <p className="text-sm leading-6 text-white/74">
          {slot.allowedServiceNames.length > 0
            ? `Služby: ${slot.allowedServiceNames.join(", ")}.`
            : "Služby nejsou omezené."}
        </p>
        <p className="text-sm leading-6 text-white/62">
          {slot.publicNote ?? slot.internalNote ?? "Bez veřejné nebo interní poznámky."}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusButton area={area} slotId={slot.id} nextStatus={primaryStatusAction.nextStatus} label={primaryStatusAction.label} returnTo={returnTo} />
        {slot.status !== AvailabilitySlotStatus.CANCELLED ? (
          <StatusButton area={area} slotId={slot.id} nextStatus={AvailabilitySlotStatus.CANCELLED} label="Zrušit" returnTo={returnTo} subtle />
        ) : null}
        {slot.status !== AvailabilitySlotStatus.ARCHIVED ? (
          <StatusButton area={area} slotId={slot.id} nextStatus={AvailabilitySlotStatus.ARCHIVED} label="Archivovat" returnTo={returnTo} subtle />
        ) : null}
        <Link
          href={getAdminSlotEditHref(area, slot.id)}
          className="rounded-full border border-white/14 bg-white/5 px-3 py-2 text-sm font-medium text-white/82 transition hover:border-white/24 hover:text-white"
        >
          Plná úprava
        </Link>
        {slot.canDelete ? (
          <form action={deleteSlotAction}>
            <input type="hidden" name="area" value={area} />
            <input type="hidden" name="slotId" value={slot.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <button
              type="submit"
              className="rounded-full border border-red-300/25 bg-red-400/10 px-3 py-2 text-sm font-medium text-red-50 transition hover:bg-red-400/18"
            >
              Smazat
            </button>
          </form>
        ) : null}
      </div>

      <details className="mt-4 rounded-[1rem] border border-white/10 bg-black/10 p-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-white">
          Rychle upravit čas a kapacitu
        </summary>
        <div className="mt-4">
          <AdminSlotQuickEditForm area={area} slot={slot} returnTo={returnTo} />
        </div>
      </details>
    </article>
  );
}

function DayStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.95rem] border border-white/8 bg-black/10 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/64">{description}</p>
    </div>
  );
}

function PanelLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full border border-[var(--color-accent)]/60 bg-[rgba(190,160,120,0.18)] px-4 py-2 text-sm font-medium text-white"
          : "rounded-full border border-white/14 bg-white/5 px-4 py-2 text-sm font-medium text-white/78 transition hover:border-white/22 hover:text-white"
      }
    >
      {label}
    </Link>
  );
}

function StatusButton({
  area,
  slotId,
  nextStatus,
  label,
  returnTo,
  subtle = false,
}: {
  area: AdminArea;
  slotId: string;
  nextStatus: AvailabilitySlotStatus;
  label: string;
  returnTo: string;
  subtle?: boolean;
}) {
  return (
    <form action={changeSlotStatusAction}>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="nextStatus" value={nextStatus} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        className={
          subtle
            ? "rounded-full border border-white/14 bg-white/5 px-3 py-2 text-sm font-medium text-white/82 transition hover:border-white/24 hover:text-white"
            : "rounded-full border border-[var(--color-accent)]/40 bg-[rgba(190,160,120,0.14)] px-3 py-2 text-sm font-medium text-white transition hover:bg-[rgba(190,160,120,0.22)]"
        }
      >
        {label}
      </button>
    </form>
  );
}

function shiftWeek(weekInput: string, offsetDays: number) {
  const current = new Date(`${weekInput}T00:00:00`);
  current.setDate(current.getDate() + offsetDays);

  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, "0");
  const day = String(current.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
