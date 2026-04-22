import { BookingStatus } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import { type ReservationsDashboardData } from "@/features/admin/lib/admin-data";
import { cn } from "@/lib/utils";

import { AdminBookingsQuickActions } from "./admin-bookings-quick-actions";
import { CreateManualBookingDrawer } from "./create-manual-booking-drawer";
import { AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminBookingsPageProps = {
  area: AdminArea;
  data: ReservationsDashboardData;
};

const columnLayout =
  "md:grid-cols-[minmax(15rem,2fr)_minmax(10rem,1fr)_minmax(7rem,0.8fr)_minmax(8.5rem,0.9fr)_minmax(10rem,1fr)] lg:grid-cols-[minmax(15rem,2fr)_minmax(10rem,1fr)_minmax(7rem,0.8fr)_minmax(8.5rem,0.9fr)_minmax(10rem,1fr)_minmax(11.75rem,11.75rem)]";

export function AdminBookingsPage({ area, data }: AdminBookingsPageProps) {
  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Full Admin sekce" : "Provozní sekce"}
      title="Rezervace"
      description={
        area === "owner"
          ? "Hustý pracovní přehled pro rychlé potvrzení, storno a otevření detailu bez vysokých karet."
          : "Denní pracovní seznam rezervací s rychlými akcemi přímo v řádku."
      }
      compact={area === "salon"}
    >
      <CreateManualBookingDrawer area={area} data={data.manualBooking} />

      <CompactStatsBar stats={data.stats} />

      <AdminPanel
        title={area === "owner" ? "Pracovní seznam rezervací" : "Rezervace k obsluze"}
        description="Řádky drží jen to podstatné: klientku, službu, termín, stav, zdroj, kontakt a rychlé akce."
        compact
      >
        {data.items.length > 0 ? (
          <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
            <div
              className={cn(
                "sticky top-0 z-10 hidden items-center gap-2 border-b border-white/10 bg-[rgba(10,9,8,0.96)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40 backdrop-blur md:grid",
                columnLayout,
              )}
            >
              <span>Rezervace</span>
              <span>Čas</span>
              <span>Status</span>
              <span>Zdroj</span>
              <span>Kontakt</span>
              <span className="hidden text-right lg:block">Akce</span>
            </div>

            <div className="divide-y divide-white/8">
              {data.items.map((booking) => (
                <article
                  key={booking.id}
                  className={cn(
                    "grid gap-2 px-4 py-2.5 transition-colors hover:bg-white/[0.03] md:items-center",
                    columnLayout,
                  )}
                >
                  <InfoCell label="Rezervace">
                    <p className="truncate text-[15px] font-medium leading-5 text-white">
                      {booking.title}
                    </p>
                    <p className="truncate text-xs text-white/56">{booking.serviceName}</p>
                  </InfoCell>

                  <InfoCell label="Čas">
                    <p className="text-[15px] font-medium leading-5 text-white">
                      {booking.scheduledTimeLabel}
                    </p>
                    <p className="text-xs text-white/56">{booking.scheduledDateLabel}</p>
                  </InfoCell>

                  <InfoCell label="Status" className="md:justify-self-center">
                    <div className="flex w-full justify-center rounded-full px-2 py-1.5">
                      <StatusBadge status={booking.status}>{booking.statusLabel}</StatusBadge>
                    </div>
                  </InfoCell>

                  <InfoCell label="Zdroj">
                    <span className="inline-flex max-w-full rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] font-medium text-white/76">
                      {booking.sourceLabel}
                    </span>
                  </InfoCell>

                  <InfoCell label="Kontakt">
                    <p className="truncate text-sm font-medium text-white/84">{booking.contactLabel}</p>
                  </InfoCell>

                  <div className="min-w-0 md:col-span-full md:mt-1 md:border-t md:border-white/8 md:pt-2 lg:col-span-1 lg:col-start-6 lg:row-start-1 lg:mt-0 lg:w-fit lg:justify-self-end lg:border-0 lg:pt-0">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/38 lg:hidden">
                      Akce
                    </p>
                    <div className="w-full lg:w-fit">
                      <AdminBookingsQuickActions
                        area={area}
                        bookingId={booking.id}
                        href={booking.href}
                        availableActions={booking.availableActions}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/4 px-4 py-5">
            <p className="text-sm font-medium text-white">Zatím tu nejsou žádné rezervace.</p>
            <p className="mt-1 text-sm text-white/62">
              Jakmile se objeví další termíny, ukážou se tady v kompaktním pracovním seznamu.
            </p>
          </div>
        )}
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
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {stats.map((stat) => (
        <article
          key={stat.label}
          className={cn(
            "rounded-full border px-3 py-2",
            getStatToneClassName(stat.tone),
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/46">{stat.label}</p>
          <p className="mt-1 text-sm font-semibold text-white">{stat.value}</p>
        </article>
      ))}
    </section>
  );
}

function InfoCell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/38 md:hidden">
        {label}
      </p>
      {children}
    </div>
  );
}

function StatusBadge({
  status,
  children,
}: {
  status: BookingStatus;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 max-w-full items-center justify-center whitespace-nowrap rounded-full border px-3 py-1.5 text-center text-[11px] font-semibold leading-4 tracking-[0.01em]",
        getStatusClassName(status),
      )}
    >
      {children}
    </span>
  );
}

function getStatusClassName(status: BookingStatus) {
  switch (status) {
    case BookingStatus.PENDING:
      return "border-amber-300/35 bg-amber-400/12 text-amber-100";
    case BookingStatus.COMPLETED:
      return "border-emerald-300/35 bg-emerald-400/12 text-emerald-100";
    case BookingStatus.CANCELLED:
      return "border-red-300/22 bg-red-400/10 text-red-100";
    case BookingStatus.CONFIRMED:
      return "border-sky-300/30 bg-sky-400/12 text-sky-100";
    case BookingStatus.NO_SHOW:
      return "border-rose-300/32 bg-rose-400/12 text-rose-100";
  }
}

function getStatToneClassName(
  tone: ReservationsDashboardData["stats"][number]["tone"],
) {
  switch (tone) {
    case "accent":
      return "border-[var(--color-accent)]/38 bg-[rgba(190,160,120,0.12)]";
    case "muted":
      return "border-white/10 bg-white/4";
    default:
      return "border-white/10 bg-black/12";
  }
}
