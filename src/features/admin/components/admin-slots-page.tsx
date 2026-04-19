import Link from "next/link";
import { AvailabilitySlotStatus } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  getAdminSlotCreateHref,
  getAdminSlotDetailHref,
  getAdminSlotStatusLabel,
} from "@/features/admin/lib/admin-slots";

import { AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminSlotsPageProps = {
  area: AdminArea;
  data: {
    area: AdminArea;
    filters: {
      dateInput: string;
      statusInput: string;
      flashMessage?: string;
    };
    slots: Array<{
      id: string;
      startsAtLabel: string;
      endsAtLabel: string;
      dateLabel: string;
      statusLabel: string;
      status: AvailabilitySlotStatus;
      occupancyLabel: string;
      activeBookingsCount: number;
      capacity: number;
      restrictionLabel: string;
      allowedServiceNames: string[];
      publicNote: string | null;
      internalNote: string | null;
      createdByLabel: string;
    }>;
  };
};

export function AdminSlotsPage({ area, data }: AdminSlotsPageProps) {
  const baseHref = area === "owner" ? "/admin/volne-terminy" : "/admin/provoz/volne-terminy";

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Správa volných termínů" : "Provozní termíny"}
      title={area === "owner" ? "Sloty pro rezervace" : "Volné termíny"}
      description={
        area === "owner"
          ? "Slot je hlavní provozní entita. Tady se ručně plánují termíny, hlídá jejich stav a omezení na služby."
          : "Jednoduchý seznam pro rychlou práci recepce i salonu. Vytvoření, úprava i blokace běží server-side bezpečně."
      }
      stats={[
        {
          label: "Celkem ve filtru",
          value: String(data.slots.length),
          tone: "accent",
        },
        {
          label: "Publikované",
          value: String(data.slots.filter((slot) => slot.status === AvailabilitySlotStatus.PUBLISHED).length),
        },
        {
          label: "Volné",
          value: String(data.slots.filter((slot) => slot.activeBookingsCount === 0).length),
        },
        {
          label: "Obsazené",
          value: String(data.slots.filter((slot) => slot.activeBookingsCount > 0).length),
          tone: "muted",
        },
      ]}
      compact={area === "salon"}
    >
      {data.filters.flashMessage ? (
        <div className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50">
          {data.filters.flashMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel
          title="Filtry a rychlé akce"
          description="Filtrovat můžeš podle dne a stavu slotu. Tvorba nového slotu je vždy po ruce."
          compact={area === "salon"}
        >
          <div className="grid gap-4">
            <form action={baseHref} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <label className="block">
                <span className="text-sm font-medium text-white">Datum</span>
                <input
                  type="date"
                  name="date"
                  defaultValue={data.filters.dateInput}
                  className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-white">Stav</span>
                <select
                  name="status"
                  defaultValue={data.filters.statusInput}
                  className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
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
                  Filtrovat
                </button>
                <Link
                  href={baseHref}
                  className="text-sm text-[var(--color-accent-soft)] transition hover:text-white"
                >
                  Reset
                </Link>
              </div>
            </form>

            <Link
              href={getAdminSlotCreateHref(area)}
              className="rounded-[1.25rem] border border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.14)] px-4 py-4 text-sm font-medium text-white transition hover:bg-[rgba(190,160,120,0.22)]"
            >
              Vytvořit nový slot
            </Link>
          </div>
        </AdminPanel>

        <AdminPanel
          title="Jak s tím pracovat"
          description="Flow je schválně jednoduché i pro roli SALON."
          compact={area === "salon"}
        >
          <div className="grid gap-3 text-sm leading-6 text-white/68">
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              1. Založ slot s časem, kapacitou a stavem.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              2. Když má platit jen pro některé služby, přepni omezení a vyber je.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              3. Detail slotu ukáže, jestli je volný nebo obsazený, a nabídne blokaci, draft i archivaci.
            </div>
          </div>
        </AdminPanel>
      </div>

      <AdminPanel
        title="Seznam slotů"
        description="Každá karta ukazuje stav, obsazení a omezení služeb bez nutnosti chodit do detailu."
        compact={area === "salon"}
      >
        {data.slots.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/4 p-5">
            <p className="text-base font-medium text-white">Ve filtru zatím není žádný slot.</p>
            <p className="mt-2 text-sm leading-6 text-white/62">
              Zkuste jiný den nebo jiný stav, případně založte nový termín.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {data.slots.map((slot) => (
              <Link
                key={slot.id}
                href={getAdminSlotDetailHref(area, slot.id)}
                className="group block rounded-[1.35rem] border border-white/8 bg-white/5 p-4 transition hover:border-white/18 hover:bg-white/8"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-medium text-white transition group-hover:text-[var(--color-accent-soft)]">
                      {slot.startsAtLabel} - {slot.endsAtLabel}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-white/58">
                      {slot.dateLabel} • {slot.statusLabel} • {slot.occupancyLabel}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--color-accent)]/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
                    {slot.activeBookingsCount}/{slot.capacity}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-white/72">
                  {slot.allowedServiceNames.length > 0
                    ? `Služby: ${slot.allowedServiceNames.join(", ")}.`
                    : "Bez omezení služeb."}{" "}
                  {slot.publicNote ?? slot.internalNote ?? "Bez poznámky."}
                </p>

                <p className="mt-2 text-sm leading-6 text-white/52">
                  {slot.restrictionLabel} • založil(a) {slot.createdByLabel}
                </p>
              </Link>
            ))}
          </div>
        )}
      </AdminPanel>
    </AdminPageShell>
  );
}
