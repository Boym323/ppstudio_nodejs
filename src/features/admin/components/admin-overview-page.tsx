import { type AdminArea } from "@/config/navigation";

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
      eyebrow={area === "owner" ? "Full Admin" : "Lite Admin"}
      title={
        area === "owner"
          ? "Plný přehled značky, rezervací a provozních rizik."
          : "Denní provoz bez zbytečné techniky navíc."
      }
      description={
        area === "owner"
          ? "Tato vrstva drží strategické řízení salonu, publikační kontrolu i dohled nad systémem. Navigace je záměrně širší, protože owner řeší obchod i provoz zároveň."
          : "Tahle varianta je zjednodušená pro recepci a běžný chod salonu. Vidíš jen to, co pomáhá rychle obsloužit klientky a udržet termíny pod kontrolou."
      }
      stats={data.stats}
      compact={area === "salon"}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPanel
          title={area === "owner" ? "Nejbližší rezervace" : "Co je nejblíž na řadě"}
          description={
            area === "owner"
              ? "Klíčové rezervace s nejbližším termínem a kontextem pro další rozhodnutí."
              : "Rychlý seznam toho, co je potřeba dnes a v nejbližších hodinách odbavit."
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
                  ? `Klientka ${booking.client.fullName} má před sebou rezervaci služby ${booking.service.name}.`
                  : `Připrav klientku ${booking.client.fullName} na službu ${booking.service.name}.`,
            }))}
            emptyTitle="Zatím tu nejsou žádné budoucí rezervace."
            emptyDescription="Jakmile klientka odešle rezervaci nebo admin vytvoří termín ručně, objeví se tady."
          />
        </AdminPanel>

        <AdminPanel
          title={area === "owner" ? "Volné a připravené termíny" : "Nejbližší volné termíny"}
          description={
            area === "owner"
              ? "Kontrola publikovaných i rozpracovaných slotů, ať víš, co je venku a co ještě čeká."
              : "Přehled termínů, které může provoz rychle zkontrolovat nebo doplnit do komunikace s klientkou."
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
                (area === "owner" ? "Bez doplněné poznámky ke slotu." : "Bez veřejné poznámky."),
              badge: slot.status,
            }))}
            emptyTitle="Volné termíny zatím nejsou vypsané."
            emptyDescription="Jakmile salon ručně založí první sloty, objeví se tady."
          />
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}
