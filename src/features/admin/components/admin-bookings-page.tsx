import Link from "next/link";
import { Suspense } from "react";

import { type AdminArea } from "@/config/navigation";
import { getReservationsData, type ReservationsDashboardData } from "@/features/admin/lib/admin-data";
import { cn } from "@/lib/utils";

import { AdminBookingsToolbar } from "./admin-bookings-toolbar";
import { AdminBookingsWorkspace } from "./admin-bookings-workspace";
import { CreateManualBookingDrawer } from "./create-manual-booking-drawer";
import { AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminBookingsPageProps = {
  area: AdminArea;
  searchParams?: Record<string, string | string[] | undefined>;
};

export function AdminBookingsPage({
  area,
  searchParams,
}: AdminBookingsPageProps) {
  const searchKey = JSON.stringify(searchParams ?? {});

  return (
    <Suspense fallback={<AdminBookingsPageSkeleton area={area} />} key={searchKey}>
      <AdminBookingsPageContent area={area} searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminBookingsPageContent({
  area,
  searchParams,
}: AdminBookingsPageProps) {
  const data = await getReservationsData(area, searchParams);

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Full Admin sekce" : "Provozní sekce"}
      title="Rezervace"
      description={
        area === "owner"
          ? "Provozní přehled pro rychlé potvrzení, storno, detail rezervace a ruční přidání termínu bez zbytečného přemýšlení."
          : "Denní pracovní seznam rezervací s jasnou prioritou a jedním klikem k akci."
      }
      compact={area === "salon"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CompactStatsBar stats={data.stats} />
        </div>
        <div className="shrink-0">
          <CreateManualBookingDrawer area={area} data={data.manualBooking} />
        </div>
      </div>

      <AdminPanel
        title={area === "owner" ? "Pracovní seznam rezervací" : "Rezervace k obsluze"}
        description="Nejdřív filtr, potom důležité rezervace a hned vedle akce. Bez návratu ke kartám."
        compact
        denseHeader
      >
        <div className="space-y-4">
          <div className="sticky top-3 z-20 -mx-1 rounded-[1.1rem] px-1 py-1 backdrop-blur">
            <AdminBookingsToolbar
              currentPath={data.currentPath}
              filters={data.filters}
              resultCount={data.summary.totalCount}
            />
          </div>

          {data.groups.length > 0 ? (
            <AdminBookingsWorkspace area={area} data={data} />
          ) : (
            <EmptyState area={area} data={data} />
          )}
        </div>
      </AdminPanel>
    </AdminPageShell>
  );
}

function CompactStatsBar({
  stats,
}: {
  stats: ReservationsDashboardData["stats"];
}) {
  return (
    <section className="flex flex-wrap gap-2">
      {stats.map((stat) => (
        <Link
          key={stat.key}
          href={stat.href}
          scroll={false}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/45",
            stat.isActive
              ? "border-[var(--color-accent)]/52 bg-[rgba(190,160,120,0.18)] text-white shadow-[0_0_0_1px_rgba(190,160,120,0.18)]"
              : "border-white/10 bg-black/12 text-white/78 hover:border-white/18 hover:bg-white/6 hover:text-white",
          )}
        >
          <span className="font-medium">{stat.label}</span>
          <span className="ml-2 text-white/58">({stat.value})</span>
        </Link>
      ))}
    </section>
  );
}

function EmptyState({
  area,
  data,
}: {
  area: AdminArea;
  data: ReservationsDashboardData;
}) {
  const emptyTitle =
    data.summary.emptyState === "pending"
      ? "Žádné čekající rezervace."
      : data.summary.emptyState === "filtered"
        ? "Filtrům teď nic neodpovídá."
        : "Zatím tu nejsou žádné rezervace.";

  const emptyDescription =
    data.summary.emptyState === "pending"
      ? "Všechny nové rezervace už jsou zpracované nebo zatím žádná další nepřišla."
      : data.summary.emptyState === "filtered"
        ? "Zkuste upravit hledání, stav, zdroj nebo datumový rozsah."
        : "Jakmile se objeví další termíny, ukážou se tady v pracovním seznamu.";

  return (
    <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/4 px-4 py-6">
      <p className="text-sm font-medium text-white">{emptyTitle}</p>
      <p className="mt-1 text-sm text-white/62">{emptyDescription}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {data.summary.emptyState !== "empty" ? (
          <a
            href={data.currentPath}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
          >
            Zrušit filtry
          </a>
        ) : null}
        <CreateManualBookingDrawer area={area} data={data.manualBooking} />
      </div>
    </div>
  );
}

function AdminBookingsPageSkeleton({ area }: { area: AdminArea }) {
  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Full Admin sekce" : "Provozní sekce"}
      title="Rezervace"
      description="Načítám pracovní přehled rezervací."
      compact={area === "salon"}
    >
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-11 w-36 animate-pulse rounded-full border border-white/8 bg-white/6"
          />
        ))}
      </div>

      <AdminPanel
        title="Pracovní seznam rezervací"
        description="Připravuji filtry a seznam rezervací."
        compact
        denseHeader
      >
        <div className="space-y-4">
          <div className="rounded-[1rem] border border-white/8 bg-[#151219]/95 px-3 py-3">
            <div className="grid gap-2 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-[0.9rem] bg-white/6" />
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.03]">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="border-b border-white/8 px-4 py-3">
                <div className="h-4 w-32 animate-pulse rounded bg-white/8" />
                <div className="mt-3 grid gap-2 md:grid-cols-6">
                  {Array.from({ length: 6 }).map((__, innerIndex) => (
                    <div key={innerIndex} className="h-10 animate-pulse rounded bg-white/6" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </AdminPanel>
    </AdminPageShell>
  );
}
