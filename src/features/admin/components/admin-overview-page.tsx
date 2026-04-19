import Link from "next/link";

import { type AdminArea } from "@/config/navigation";
import { getAdminBookingHref } from "@/features/admin/lib/admin-booking";

import { getAdminOverviewData } from "../lib/admin-data";
import { AdminKeyValueList, AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminOverviewPageProps = {
  area: AdminArea;
};

const formatCardDateTime = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export async function AdminOverviewPage({ area }: AdminOverviewPageProps) {
  const data = await getAdminOverviewData(area);

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Full Admin" : "Provoz salonu"}
      title={
        area === "owner"
          ? "Plný přehled značky, rezervací a provozu."
          : "Denní provoz bez zbytečných detailů."
      }
      description={
        area === "owner"
          ? "Tady je strategický přehled salonu, publikace i provozních rizik."
          : "Tahle varianta je zjednodušená pro recepci a běžný chod salonu."
      }
      stats={data.stats}
      compact={area === "salon"}
    >
      {area === "salon" ? (
        <AdminPanel
          title="Rychlé akce"
          description="Všechno důležité na jeden klik."
          compact
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href="/admin/provoz/volne-terminy/novy"
              className="rounded-[1.5rem] border border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.14)] px-4 py-4 text-left transition hover:bg-[rgba(190,160,120,0.22)]"
            >
              <span className="block text-sm font-medium text-white">Přidat termín</span>
              <span className="mt-2 block text-sm leading-6 text-white/68">
                Otevři formulář pro nový termín.
              </span>
            </Link>
            <Link
              href="/admin/provoz/rezervace"
              className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-white/20 hover:bg-white/8"
            >
              <span className="block text-sm font-medium text-white">Práce s rezervací</span>
              <span className="mt-2 block text-sm leading-6 text-white/68">
                Zkontroluj dnešní rezervace i nejbližší další.
              </span>
            </Link>
            <Link
              href="/admin/provoz/klienti"
              className="rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-white/20 hover:bg-white/8"
            >
              <span className="block text-sm font-medium text-white">Otevřít klientku</span>
              <span className="mt-2 block text-sm leading-6 text-white/68">
                Najdi kontakt a poslední návštěvu.
              </span>
            </Link>
          </div>
        </AdminPanel>
      ) : null}

      {area === "salon" ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <AdminPanel
          title="Dnešní rezervace"
          description="Co se děje dnes a co má přijít hned po tom."
          compact
        >
            <AdminKeyValueList
              items={data.todayBookingItems.map((booking, index) => ({
                id: booking.id,
                title: `${booking.client.fullName} • ${booking.service.name}`,
                meta: formatCardDateTime.format(booking.scheduledStartsAt),
                description:
                  index === 0
                    ? "Nejbližší rezervace."
                    : "Další rezervace v dnešním pořadí.",
                badge: index === 0 ? "teď" : "dnes",
                href: getAdminBookingHref(area, booking.id),
              }))}
              emptyTitle="Na dnešek zatím nejsou žádné rezervace."
              emptyDescription="Jakmile se objeví první termín, zobrazí se tady."
            />
          </AdminPanel>

          <AdminPanel
          title="Nejbližší další termíny"
          description="Hned vidíš, co je v nejbližším pořadí dál."
          compact
        >
            <AdminKeyValueList
              items={data.nextSlots.slice(0, 3).map((slot, index) => ({
                id: slot.id,
                title: formatCardDateTime.format(slot.startsAt),
                meta: `Kapacita ${slot.capacity}`,
                description:
                  index === 0
                    ? "Nejbližší volný termín."
                    : "Další volný termín v pořadí.",
                badge: slot.status,
              }))}
              emptyTitle="Zatím nejsou vypsané další termíny."
              emptyDescription="Jakmile přibudou, objeví se tady."
            />
          </AdminPanel>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanel
          title={area === "owner" ? "Nejbližší rezervace" : "Další rezervace"}
          description={
            area === "owner"
              ? "Rezervace s nejbližším termínem."
              : "Rezervace, které přicházejí po dnešním seznamu."
          }
          compact={area === "salon"}
        >
          <AdminKeyValueList
            items={data.recentBookings.map((booking) => ({
              id: booking.id,
              title: `${booking.client.fullName} • ${booking.service.name}`,
              meta: formatCardDateTime.format(booking.scheduledStartsAt),
              description:
                area === "owner"
                  ? `Klientka ${booking.client.fullName} má rezervaci služby ${booking.service.name}.`
                  : `Připrav klientku ${booking.client.fullName} na službu ${booking.service.name}.`,
              href: getAdminBookingHref(area, booking.id),
            }))}
            emptyTitle="Zatím tu nejsou žádné budoucí rezervace."
            emptyDescription="Jakmile přijde nová rezervace, objeví se tady."
          />
        </AdminPanel>

        <AdminPanel
          title={area === "owner" ? "Volné a připravené termíny" : "Další volné termíny"}
          description={
            area === "owner"
              ? "Kontrola publikovaných i rozpracovaných termínů."
              : "Přehled termínů, které můžeš rychle doplnit nebo poslat dál."
          }
          compact={area === "salon"}
        >
          <AdminKeyValueList
            items={data.nextSlots.map((slot) => ({
              id: slot.id,
              title: formatCardDateTime.format(slot.startsAt),
              meta: `Kapacita ${slot.capacity} • obsazeno ${slot.bookings.length}`,
              description:
                slot.publicNote ??
                (area === "owner" ? "Bez poznámky." : "Bez veřejné poznámky."),
              badge: slot.status,
            }))}
            emptyTitle="Volné termíny zatím nejsou vypsané."
            emptyDescription="Jakmile salon založí první termíny, objeví se tady."
          />
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}
