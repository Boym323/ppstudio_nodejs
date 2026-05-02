import { Suspense } from "react";

import { type AdminArea } from "@/config/navigation";
import {
  getManualBookingClientById,
  getReservationsData,
  type ReservationsDashboardData,
} from "@/features/admin/lib/admin-data";

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
  const requestedClientId = readSearchParam(searchParams, "clientId");
  const shouldOpenCreateDrawer = readSearchParam(searchParams, "create") === "1" || requestedClientId.length > 0;
  const activeClientMatch =
    requestedClientId.length > 0
      ? data.manualBooking.clients.find((client) => client.id === requestedClientId) ?? null
      : null;
  const prefilledClient =
    activeClientMatch ?? (requestedClientId.length > 0 ? await getManualBookingClientById(requestedClientId) : null);
  const prefillWarning =
    requestedClientId.length === 0 || !shouldOpenCreateDrawer
      ? null
      : !prefilledClient
        ? "Klientku se nepodařilo předvyplnit."
        : !prefilledClient.isActive
          ? "Klientka je neaktivní."
          : null;

  return (
    <AdminPageShell
      title="Rezervace"
      description="Provozní přehled rezervací, potvrzení a ručního přidání."
      headerActions={
        <CreateManualBookingDrawer
          area={area}
          data={data.manualBooking}
          initialOpen={shouldOpenCreateDrawer}
          prefilledClient={prefilledClient}
          prefillWarning={prefillWarning}
        />
      }
      compact={area === "salon"}
      denseIntro
    >
      <CompactKpiStrip kpis={data.kpis} />

      <AdminPanel
        title={area === "owner" ? "Pracovní seznam" : "Rezervace k obsluze"}
        description="Čekající rezervace zůstávají nahoře, filtry i akce jsou v jednom pracovním toku."
        compact
        denseHeader
      >
        <div className="space-y-4">
          <div className="sticky top-3 z-20 -mx-1 rounded-[1.1rem] px-1 py-1 backdrop-blur">
            <AdminBookingsToolbar
              currentPath={data.currentPath}
              filters={data.filters}
              resultCount={data.summary.totalCount}
              stats={data.stats}
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

function CompactKpiStrip({
  kpis,
}: {
  kpis: ReservationsDashboardData["kpis"];
}) {
  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <article
          key={kpi.key}
          className="flex min-h-14 items-center justify-between rounded-[1rem] border border-white/10 bg-white/[0.045] px-3.5 py-2.5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/48">
            {kpi.label}
          </p>
          <p className="font-display text-xl text-white">{kpi.value}</p>
        </article>
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
  const emptyTitle = "Nenalezeny žádné rezervace.";

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

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = searchParams?.[key];

  if (typeof value === "string") {
    return value.trim();
  }

  return Array.isArray(value) ? (value[0] ?? "").trim() : "";
}

function AdminBookingsPageSkeleton({ area }: { area: AdminArea }) {
  return (
    <AdminPageShell
      title="Rezervace"
      description="Načítám pracovní přehled rezervací."
      compact={area === "salon"}
      denseIntro
    >
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-14 animate-pulse rounded-[1rem] border border-white/8 bg-white/6"
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
            <div className="flex flex-wrap gap-2 border-b border-white/8 pb-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-9 w-28 animate-pulse rounded-full bg-white/6" />
              ))}
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-7">
              {Array.from({ length: 7 }).map((_, index) => (
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
