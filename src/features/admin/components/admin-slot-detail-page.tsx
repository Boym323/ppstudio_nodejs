import Link from "next/link";
import { AvailabilitySlotStatus } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  changeSlotStatusAction,
  deleteSlotAction,
} from "@/features/admin/actions/slot-actions";
import {
  getAdminSlotEditHref,
  getAdminSlotListHref,
} from "@/features/admin/lib/admin-slots";

import { AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminSlotDetailPageProps = {
  area: AdminArea;
  flashMessage?: string;
  data: {
    id: string;
    title: string;
    status: AvailabilitySlotStatus;
    statusLabel: string;
    occupancyLabel: string;
    startsAtLabel: string;
    endsAtLabel: string;
    createdAtLabel: string;
    updatedAtLabel: string;
    publishedAtLabel: string;
    cancelledAtLabel: string;
    capacity: number;
    activeBookingsCount: number;
    freeCapacity: number;
    restrictionLabel: string;
    publicNote: string | null;
    internalNote: string | null;
    allowedServices: Array<{
      id: string;
      name: string;
      durationMinutes: number;
      isActive: boolean;
    }>;
    bookings: Array<{
      id: string;
      clientName: string;
      serviceName: string;
      statusLabel: string;
      scheduledAtLabel: string;
    }>;
    createdByLabel: string;
    canDelete: boolean;
    deleteBlockedReason: string | null;
  };
};

export function AdminSlotDetailPage({
  area,
  flashMessage,
  data,
}: AdminSlotDetailPageProps) {
  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Správa slotu" : "Detail termínu"}
      title={data.title}
      description={
        area === "owner"
          ? "Detail slotu drží provozní stav, omezení služeb i rychlé bezpečné akce bez obcházení serverových pravidel."
          : "Jednoduchý detail pro rychlou práci za provozu. Nejdůležitější stav a akce jsou nahoře."
      }
      stats={[
        { label: "Stav", value: data.statusLabel, tone: "accent" },
        { label: "Obsazení", value: `${data.activeBookingsCount}/${data.capacity}` },
        { label: "Volná kapacita", value: String(data.freeCapacity) },
        { label: "Služby", value: data.restrictionLabel, tone: "muted" },
      ]}
      compact={area === "salon"}
    >
      {flashMessage ? (
        <div className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50">
          {flashMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminPanel
          title="Přehled slotu"
          description="Vše podstatné o termínu na jednom místě včetně informací, zda je volný nebo obsazený."
          compact={area === "salon"}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <DetailCard label="Začátek" value={data.startsAtLabel} />
            <DetailCard label="Konec" value={data.endsAtLabel} />
            <DetailCard label="Obsazení" value={`${data.occupancyLabel} • ${data.activeBookingsCount}/${data.capacity}`} />
            <DetailCard label="Založil" value={data.createdByLabel} />
            <DetailCard label="Publikováno" value={data.publishedAtLabel} />
            <DetailCard label="Blokováno" value={data.cancelledAtLabel} />
          </div>

          <div className="mt-5 grid gap-4">
            <InfoBlock
              title="Povolené služby"
              body={
                data.allowedServices.length > 0
                  ? data.allowedServices
                      .map((service) =>
                        `${service.name} (${service.durationMinutes} min${service.isActive ? "" : ", neaktivní"})`,
                      )
                      .join(", ")
                  : "Slot není omezený na konkrétní služby."
              }
            />
            <InfoBlock title="Veřejná poznámka" body={data.publicNote ?? "Bez veřejné poznámky."} />
            <InfoBlock title="Interní poznámka" body={data.internalNote ?? "Bez interní poznámky."} />
          </div>
        </AdminPanel>

        <AdminPanel
          title="Rychlé akce"
          description="Použij to, co je potřeba teď: upravit, stáhnout z webu, blokovat nebo archivovat."
          compact={area === "salon"}
        >
          <div className="grid gap-3">
            <Link
              href={getAdminSlotEditHref(area, data.id)}
              className="rounded-[1.25rem] border border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.14)] px-4 py-4 text-sm font-medium text-white transition hover:bg-[rgba(190,160,120,0.22)]"
            >
              Upravit slot
            </Link>

            <StatusActionForm
              area={area}
              slotId={data.id}
              nextStatus={AvailabilitySlotStatus.PUBLISHED}
              label="Publikovat slot"
              helper="Zviditelní termín pro veřejné rezervace."
            />
            <StatusActionForm
              area={area}
              slotId={data.id}
              nextStatus={AvailabilitySlotStatus.DRAFT}
              label="Stáhnout do draftu"
              helper="Slot zůstane v adminu, ale nebude veřejně dostupný."
            />
            <StatusActionForm
              area={area}
              slotId={data.id}
              nextStatus={AvailabilitySlotStatus.CANCELLED}
              label="Blokovat slot"
              helper="Slot se už nebude nabízet pro nové rezervace."
            />
            <StatusActionForm
              area={area}
              slotId={data.id}
              nextStatus={AvailabilitySlotStatus.ARCHIVED}
              label="Archivovat slot"
              helper="Použij pro uzavřené nebo historické sloty bez aktivní rezervace."
            />

            {data.canDelete ? (
              <form action={deleteSlotAction}>
                <input type="hidden" name="area" value={area} />
                <input type="hidden" name="slotId" value={data.id} />
                <button
                  type="submit"
                  className="w-full rounded-[1.25rem] border border-red-300/25 bg-red-400/10 px-4 py-4 text-left text-sm font-medium text-red-50 transition hover:bg-red-400/18"
                >
                  Smazat slot
                </button>
              </form>
            ) : (
              <div className="rounded-[1.25rem] border border-white/10 bg-white/4 px-4 py-4 text-sm leading-6 text-white/68">
                {data.deleteBlockedReason}
              </div>
            )}

            <Link
              href={getAdminSlotListHref(area)}
              className="text-sm text-[var(--color-accent-soft)] transition hover:text-white"
            >
              Zpět na seznam slotů
            </Link>
          </div>
        </AdminPanel>
      </div>

      <AdminPanel
        title="Navázané rezervace"
        description="Rychlá kontrola, jestli je slot pořád volný nebo už na něj něco navazuje."
        compact={area === "salon"}
      >
        {data.bookings.length === 0 ? (
          <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/4 p-5 text-sm leading-6 text-white/68">
            Slot je zatím bez rezervace.
          </div>
        ) : (
          <div className="grid gap-3">
            {data.bookings.map((booking) => (
              <article
                key={booking.id}
                className="rounded-[1.25rem] border border-white/8 bg-white/5 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {booking.clientName} • {booking.serviceName}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-white/60">
                      {booking.scheduledAtLabel}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--color-accent)]/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
                    {booking.statusLabel}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </AdminPanel>
    </AdminPageShell>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-white/45">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white">{value}</p>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/68">{body}</p>
    </div>
  );
}

function StatusActionForm({
  area,
  slotId,
  nextStatus,
  label,
  helper,
}: {
  area: AdminArea;
  slotId: string;
  nextStatus: AvailabilitySlotStatus;
  label: string;
  helper: string;
}) {
  return (
    <form action={changeSlotStatusAction}>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="nextStatus" value={nextStatus} />
      <button
        type="submit"
        className="w-full rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-white/18 hover:bg-white/8"
      >
        <span className="block text-sm font-medium text-white">{label}</span>
        <span className="mt-2 block text-sm leading-6 text-white/62">{helper}</span>
      </button>
    </form>
  );
}
