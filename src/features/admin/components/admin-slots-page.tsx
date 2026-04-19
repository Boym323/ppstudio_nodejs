import Link from "next/link";
import { AvailabilitySlotStatus } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import { changeSlotStatusAction } from "@/features/admin/actions/slot-actions";
import {
  AdminBatchCreateSlotForm,
  AdminQuickCreateSlotForm,
  AdminSlotQuickEditForm,
} from "@/features/admin/components/admin-slot-planner-forms";
import {
  getAdminSlotDetailHref,
  getAdminSlotEditHref,
  getAdminSlotPlannerHref,
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

const slotToneClasses: Record<AvailabilitySlotStatus, string> = {
  DRAFT: "border-amber-300/30 bg-amber-400/10 text-amber-50",
  PUBLISHED: "border-emerald-300/40 bg-emerald-500/15 text-emerald-50",
  CANCELLED: "border-red-300/30 bg-red-400/10 text-red-50",
  ARCHIVED: "border-white/12 bg-white/5 text-white/66",
};

const statusOptions = [
  { value: "ALL", label: "Vše" },
  { value: AvailabilitySlotStatus.PUBLISHED, label: "Publikované" },
  { value: AvailabilitySlotStatus.DRAFT, label: "Rozpracované" },
  { value: AvailabilitySlotStatus.CANCELLED, label: "Zrušené" },
  { value: AvailabilitySlotStatus.ARCHIVED, label: "Archivované" },
] as const;

function shiftDateKey(dateKey: string, days: number) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  parsed.setDate(parsed.getDate() + days);

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function withAnchor(href: string, anchor = "day-workspace") {
  return `${href}#${anchor}`;
}

function getSlotTimelineStyle(slot: AdminSlotPlannerSlot) {
  const dayStartMinutes = 6 * 60;
  const dayEndMinutes = 22 * 60;
  const totalMinutes = dayEndMinutes - dayStartMinutes;
  const startsAt = new Date(slot.startsAtInput);
  const endsAt = new Date(slot.endsAtInput);
  const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
  const endMinutes = endsAt.getHours() * 60 + endsAt.getMinutes();
  const offset = ((Math.max(startMinutes, dayStartMinutes) - dayStartMinutes) / totalMinutes) * 100;
  const width =
    ((Math.min(endMinutes, dayEndMinutes) - Math.max(startMinutes, dayStartMinutes)) / totalMinutes) *
    100;

  return {
    left: `${Math.max(0, Math.min(offset, 100))}%`,
    width: `${Math.max(4, Math.min(width, 100))}%`,
  };
}

function getSlotStatusActions(slot: AdminSlotPlannerSlot) {
  switch (slot.status) {
    case AvailabilitySlotStatus.DRAFT:
      return [
        { nextStatus: AvailabilitySlotStatus.PUBLISHED, label: "Publikovat", tone: "primary" as const },
        { nextStatus: AvailabilitySlotStatus.CANCELLED, label: "Zrušit", tone: "neutral" as const },
      ];
    case AvailabilitySlotStatus.PUBLISHED:
      return [
        { nextStatus: AvailabilitySlotStatus.DRAFT, label: "Stáhnout", tone: "neutral" as const },
        { nextStatus: AvailabilitySlotStatus.CANCELLED, label: "Blokovat", tone: "danger" as const },
      ];
    case AvailabilitySlotStatus.CANCELLED:
      return [
        { nextStatus: AvailabilitySlotStatus.PUBLISHED, label: "Obnovit", tone: "primary" as const },
        ...(slot.hasActiveBookings
          ? []
          : [{ nextStatus: AvailabilitySlotStatus.ARCHIVED, label: "Archivovat", tone: "neutral" as const }]),
      ];
    case AvailabilitySlotStatus.ARCHIVED:
      return [{ nextStatus: AvailabilitySlotStatus.PUBLISHED, label: "Obnovit", tone: "primary" as const }];
  }
}

export function AdminSlotsPage({ area, data }: AdminSlotsPageProps) {
  const compact = area === "salon";
  const previousWeekHref = getAdminSlotPlannerHref(area, {
    week: shiftDateKey(data.filters.weekInput, -7),
    day: data.selectedDay.dateKey,
    status: data.filters.statusInput,
  });
  const nextWeekHref = getAdminSlotPlannerHref(area, {
    week: shiftDateKey(data.filters.weekInput, 7),
    day: data.selectedDay.dateKey,
    status: data.filters.statusInput,
  });
  const resetWeekHref = getAdminSlotPlannerHref(area, {
    day: data.selectedDay.dateKey,
    status: data.filters.statusInput,
  });
  const createHref = getAdminSlotPlannerHref(area, {
    week: data.filters.weekInput,
    day: data.selectedDay.dateKey,
    status: data.filters.statusInput,
    panel: "create",
  });
  const batchHref = getAdminSlotPlannerHref(area, {
    week: data.filters.weekInput,
    day: data.selectedDay.dateKey,
    status: data.filters.statusInput,
    panel: "batch",
  });

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Týdenní plánování dostupností" : "Týdenní plán salonu"}
      title={area === "owner" ? "Volné termíny po týdnech" : "Plán volných termínů"}
      description={
        area === "owner"
          ? "Týden je hlavní pracovní plocha. Přehled dnů rychle ukáže, kde je dostupnost hotová, kde je den prázdný a kde je potřeba udělat provozní zásah."
          : "Celý týden slouží jako hlavní pracovní plocha. Dny jsou čitelné i na mobilu a nejběžnější úpravy uděláte přímo z přehledu bez složitého přepínání."
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(22rem,0.95fr)]">
        <AdminPanel
          title="Týdenní přehled"
          description="Každý den je samostatná karta. Vyber den, zkontroluj rozložení času a rovnou z něj přidej nebo uprav slot."
          compact={compact}
        >
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={previousWeekHref}
                className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white/82"
              >
                Minulý týden
              </Link>
              <div className="rounded-full border border-[var(--color-accent)]/35 bg-[rgba(190,160,120,0.12)] px-4 py-2 text-sm font-medium text-white">
                {data.weekLabel}
              </div>
              <Link
                href={nextWeekHref}
                className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white/82"
              >
                Další týden
              </Link>
              <Link
                href={resetWeekHref}
                className="text-sm font-medium text-[var(--color-accent-soft)] transition hover:text-white"
              >
                Aktuální týden
              </Link>
            </div>

            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => {
                const href = getAdminSlotPlannerHref(area, {
                  week: data.filters.weekInput,
                  day: data.selectedDay.dateKey,
                  status: option.value,
                });
                const active = data.filters.statusInput === option.value;

                return (
                  <Link
                    key={option.value}
                    href={href}
                    className={
                      active
                        ? "rounded-full border border-[var(--color-accent)]/40 bg-[rgba(190,160,120,0.18)] px-4 py-2 text-sm font-medium text-white"
                        : "rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white/72"
                    }
                  >
                    {option.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            {data.days.map((day) => {
              const dayHref = withAnchor(
                getAdminSlotPlannerHref(area, {
                  week: data.filters.weekInput,
                  day: day.dateKey,
                  status: data.filters.statusInput,
                }),
              );
              const createDayHref = withAnchor(
                getAdminSlotPlannerHref(area, {
                  week: data.filters.weekInput,
                  day: day.dateKey,
                  status: data.filters.statusInput,
                  panel: "create",
                }),
              );
              const batchDayHref = withAnchor(
                getAdminSlotPlannerHref(area, {
                  week: data.filters.weekInput,
                  day: day.dateKey,
                  status: data.filters.statusInput,
                  panel: "batch",
                }),
              );

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
                      <p className="mt-2 text-xs leading-5 text-white/64">{day.timeRangeLabel}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${dayToneClasses[day.stateTone]}`}>
                      {day.stateLabel}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <DayMetric label="Sloty" value={String(day.slotCount)} />
                    <DayMetric label="Volné" value={String(day.freeCount)} />
                    <DayMetric label="Plné" value={String(day.occupiedCount)} />
                    <DayMetric label="Zrušené" value={String(day.cancelledCount + day.archivedCount)} />
                  </div>

                  <div className="mt-4 rounded-[1rem] border border-white/10 bg-black/12 p-3">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/40">
                      <span>Rozložení dne</span>
                      <span>06-22</span>
                    </div>
                    <div className="relative mt-3 h-12 rounded-[0.9rem] border border-white/8 bg-white/5">
                      {day.slots.length === 0 ? (
                        <div className="flex h-full items-center px-3 text-xs text-white/48">Bez slotů</div>
                      ) : (
                        day.slots.map((slot) => (
                          <Link
                            key={slot.id}
                            href={withAnchor(
                              getAdminSlotPlannerHref(area, {
                                week: data.filters.weekInput,
                                day: day.dateKey,
                                status: data.filters.statusInput,
                                slot: slot.id,
                              }),
                            )}
                            className={`absolute top-2 bottom-2 rounded-[0.75rem] border ${slotToneClasses[slot.status]}`}
                            style={getSlotTimelineStyle(slot)}
                            aria-label={`${slot.timeRangeLabel}, ${slot.statusLabel}`}
                          />
                        ))
                      )}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-white/58">{day.summaryLabel}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={createDayHref}
                      className="rounded-full border border-emerald-300/40 bg-emerald-500/12 px-3 py-2 text-sm font-medium text-emerald-50"
                    >
                      Přidat slot
                    </Link>
                    <Link
                      href={batchDayHref}
                      className="rounded-full border border-white/14 bg-white/5 px-3 py-2 text-sm font-medium text-white/82"
                    >
                      Přidat sérii
                    </Link>
                    <Link
                      href={dayHref}
                      className="rounded-full border border-white/14 bg-white/5 px-3 py-2 text-sm font-medium text-white/82"
                    >
                      Otevřít den
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {day.slots.length === 0 ? (
                      <div className="rounded-[1rem] border border-dashed border-emerald-300/25 bg-emerald-400/8 px-3 py-4 text-sm leading-6 text-emerald-50/82">
                        Den je zatím prázdný. Výchozí okno je {day.availabilityWindowLabel}.
                      </div>
                    ) : (
                      day.slots.slice(0, 4).map((slot) => (
                        <Link
                          key={slot.id}
                          href={withAnchor(
                            getAdminSlotPlannerHref(area, {
                              week: data.filters.weekInput,
                              day: day.dateKey,
                              status: data.filters.statusInput,
                              slot: slot.id,
                            }),
                          )}
                          className={`rounded-[1rem] border px-3 py-3 text-left ${slotToneClasses[slot.status]}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-white">{slot.timeRangeLabel}</span>
                            <span className="text-[11px] text-white/58">{slot.occupancyLabel}</span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-white/62">
                            {slot.allowedServiceNames.length > 0
                              ? slot.allowedServiceNames.join(", ")
                              : "Bez omezení služeb"}
                          </p>
                        </Link>
                      ))
                    )}
                    {day.slots.length > 4 ? (
                      <Link href={dayHref} className="text-sm font-medium text-[var(--color-accent-soft)] transition hover:text-white">
                        Zobrazit další sloty ({day.slots.length - 4})
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </AdminPanel>

        <DayWorkspace
          area={area}
          compact={compact}
          data={data}
          createHref={createHref}
          batchHref={batchHref}
        />
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[rgba(16,15,17,0.96)] p-4 backdrop-blur xl:hidden">
        <div className="pointer-events-auto flex gap-3">
          <Link
            href={withAnchor(createHref)}
            className="flex-1 rounded-full bg-[var(--color-accent)] px-4 py-3 text-center text-sm font-semibold text-[var(--color-accent-contrast)]"
          >
            Přidat slot
          </Link>
          <Link
            href={withAnchor(batchHref)}
            className="flex-1 rounded-full border border-white/12 bg-white/6 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Přidat sérii
          </Link>
        </div>
      </div>

      <div className="h-24 xl:hidden" />
    </AdminPageShell>
  );
}

function DayWorkspace({
  area,
  compact,
  data,
  createHref,
  batchHref,
}: {
  area: AdminArea;
  compact: boolean;
  data: AdminSlotPlannerData;
  createHref: string;
  batchHref: string;
}) {
  const dayHref = getAdminSlotPlannerHref(area, {
    week: data.filters.weekInput,
    day: data.selectedDay.dateKey,
    status: data.filters.statusInput,
  });
  const selectedSlotReturnTo =
    data.selectedSlot
      ? getAdminSlotPlannerHref(area, {
          week: data.filters.weekInput,
          day: data.selectedDay.dateKey,
          status: data.filters.statusInput,
          slot: data.selectedSlot.id,
        })
      : dayHref;

  return (
    <AdminPanel
      title={`Den ${data.selectedDay.headingLabel}`}
      description="Sekundární pracovní panel vybraného dne. Odtud řešíš přidání slotu, sérii i rychlou úpravu konkrétního termínu."
      compact={compact}
    >
      <div id="day-workspace" className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={dayHref}
            className={
              data.filters.panelInput === "day"
                ? "rounded-full border border-[var(--color-accent)]/40 bg-[rgba(190,160,120,0.18)] px-4 py-2 text-sm font-medium text-white"
                : "rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white/78"
            }
          >
            Přehled dne
          </Link>
          <Link
            href={createHref}
            className={
              data.filters.panelInput === "create"
                ? "rounded-full border border-emerald-300/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-50"
                : "rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white/78"
            }
          >
            Přidat slot
          </Link>
          <Link
            href={batchHref}
            className={
              data.filters.panelInput === "batch"
                ? "rounded-full border border-emerald-300/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-50"
                : "rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white/78"
            }
          >
            Přidat sérii
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DayMetric label="Stav dne" value={data.selectedDay.stateLabel} />
          <DayMetric label="Čas dne" value={data.selectedDay.timeRangeLabel} />
          <DayMetric label="Publikované" value={String(data.selectedDay.publishedCount)} />
          <DayMetric label="Prázdné kapacity" value={String(data.selectedDay.freeCount)} />
        </div>

        {data.filters.panelInput === "create" ? (
          <div className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-500/8 p-4">
            <p className="text-sm font-medium text-white">Rychlé přidání slotu</p>
            <p className="mt-2 text-sm leading-6 text-white/68">
              Krátký formulář pro jeden termín. Pokud bude potřeba doplnit služby nebo poznámky, naváže na něj plná editace.
            </p>
            <div className="mt-4">
              <AdminQuickCreateSlotForm
                area={area}
                startsAtInput={data.selectedDay.suggestedStartsAtInput}
                endsAtInput={data.selectedDay.suggestedEndsAtInput}
                returnTo={dayHref}
              />
            </div>
          </div>
        ) : null}

        {data.filters.panelInput === "batch" ? (
          <div className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-500/8 p-4">
            <p className="text-sm font-medium text-white">Dávkové přidání slotů</p>
            <p className="mt-2 text-sm leading-6 text-white/68">
              Série založí více jednoduchých slotů v jednom dni a používá stejnou server-side validaci jako jednotlivý slot.
            </p>
            <div className="mt-4">
              <AdminBatchCreateSlotForm
                area={area}
                day={data.selectedDay.dateKey}
                suggestedStartsAtInput={data.selectedDay.suggestedStartsAtInput}
                returnTo={dayHref}
              />
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-medium text-white">Sloty dne</h4>
              <p className="text-sm leading-6 text-white/62">
                {data.selectedDay.slotCount === 0
                  ? "Den zatím nemá žádný slot."
                  : "Vyber slot pro rychlou úpravu času a stavu přímo z týdenního planneru."}
              </p>
            </div>
            {data.selectedSlot ? (
              <Link
                href={getAdminSlotDetailHref(area, data.selectedSlot.id)}
                className="text-sm font-medium text-[var(--color-accent-soft)] transition hover:text-white"
              >
                Otevřít detail slotu
              </Link>
            ) : null}
          </div>

          {data.selectedDay.slots.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/4 p-5 text-sm leading-6 text-white/68">
              Den je prázdný. Nejrychlejší cesta je použít akci `Přidat slot` nebo `Přidat sérii`.
            </div>
          ) : (
            data.selectedDay.slots.map((slot) => {
              const selected = data.selectedSlot?.id === slot.id;
              const slotSelectHref = withAnchor(
                getAdminSlotPlannerHref(area, {
                  week: data.filters.weekInput,
                  day: data.selectedDay.dateKey,
                  status: data.filters.statusInput,
                  slot: slot.id,
                }),
              );

              return (
                <article
                  key={slot.id}
                  className={
                    selected
                      ? "rounded-[1.35rem] border border-[var(--color-accent)]/35 bg-[rgba(190,160,120,0.12)] p-4"
                      : "rounded-[1.35rem] border border-white/8 bg-white/5 p-4"
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={slotSelectHref} className="text-lg font-medium text-white transition hover:text-[var(--color-accent-soft)]">
                        {slot.timeRangeLabel}
                      </Link>
                      <p className="mt-1 text-sm leading-6 text-white/64">
                        {slot.occupancyLabel} • {slot.statusLabel} • {slot.restrictionLabel}
                      </p>
                      {slot.allowedServiceNames.length > 0 ? (
                        <p className="text-sm leading-6 text-white/56">{slot.allowedServiceNames.join(", ")}</p>
                      ) : null}
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-medium ${slotToneClasses[slot.status]}`}>
                      {slot.statusLabel}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={slotSelectHref}
                      className="rounded-full border border-white/12 bg-white/6 px-3 py-2 text-sm font-medium text-white/82"
                    >
                      {selected ? "Vybraný slot" : "Vybrat slot"}
                    </Link>
                    <Link
                      href={getAdminSlotEditHref(area, slot.id)}
                      className="rounded-full border border-white/12 bg-white/6 px-3 py-2 text-sm font-medium text-white/82"
                    >
                      Plná úprava
                    </Link>
                    <Link
                      href={getAdminSlotDetailHref(area, slot.id)}
                      className="rounded-full border border-white/12 bg-white/6 px-3 py-2 text-sm font-medium text-white/82"
                    >
                      Detail
                    </Link>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {getSlotStatusActions(slot).map((action) => (
                      <SlotStatusActionButton
                        key={`${slot.id}-${action.nextStatus}`}
                        area={area}
                        slotId={slot.id}
                        nextStatus={action.nextStatus}
                        label={action.label}
                        tone={action.tone}
                        returnTo={selected ? selectedSlotReturnTo : dayHref}
                      />
                    ))}
                  </div>

                  {selected ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoCard
                          label="Veřejná poznámka"
                          value={slot.publicNote ?? "Bez veřejné poznámky"}
                        />
                        <InfoCard
                          label="Interní poznámka"
                          value={slot.internalNote ?? "Bez interní poznámky"}
                        />
                      </div>
                      <AdminSlotQuickEditForm area={area} slot={slot} returnTo={selectedSlotReturnTo} />
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </div>
    </AdminPanel>
  );
}

function DayMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.22em] text-white/42">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-white/10 bg-black/15 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-white/42">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white/72">{value}</p>
    </div>
  );
}

function SlotStatusActionButton({
  area,
  slotId,
  nextStatus,
  label,
  tone,
  returnTo,
}: {
  area: AdminArea;
  slotId: string;
  nextStatus: AvailabilitySlotStatus;
  label: string;
  tone: "primary" | "neutral" | "danger";
  returnTo: string;
}) {
  const toneClass =
    tone === "primary"
      ? "border-emerald-300/35 bg-emerald-500/12 text-emerald-50"
      : tone === "danger"
        ? "border-red-300/30 bg-red-400/10 text-red-50"
        : "border-white/12 bg-white/6 text-white/82";

  return (
    <form action={changeSlotStatusAction}>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="nextStatus" value={nextStatus} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button type="submit" className={`rounded-full border px-3 py-2 text-sm font-medium ${toneClass}`}>
        {label}
      </button>
    </form>
  );
}
