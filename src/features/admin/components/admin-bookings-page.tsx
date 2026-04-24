import { BookingStatus } from "@prisma/client";
import Link from "next/link";

import { type AdminArea } from "@/config/navigation";
import { AdminBookingsToolbar } from "@/features/admin/components/admin-bookings-toolbar";
import { getReservationsData, type ReservationsDashboardData } from "@/features/admin/lib/admin-data";
import { cn } from "@/lib/utils";

import { AdminBookingsQuickActions } from "./admin-bookings-quick-actions";
import { CreateManualBookingDrawer } from "./create-manual-booking-drawer";
import { AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminBookingsPageProps = {
  area: AdminArea;
  searchParams?: Record<string, string | string[] | undefined>;
};

const columnLayout =
  "md:grid-cols-[minmax(15rem,2fr)_minmax(10rem,1fr)_minmax(7rem,0.8fr)_minmax(7rem,0.7fr)_minmax(11rem,1fr)_minmax(12rem,auto)]";

export async function AdminBookingsPage({
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
          ? "Provozní přehled pro rychlé potvrzení, storno, dohledání detailu a ruční přidání rezervace."
          : "Denní pracovní seznam rezervací s rychlými akcemi a okamžitou orientací v termínech."
      }
      compact={area === "salon"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CompactStatsBar stats={data.stats} />
        </div>
        <div className="shrink-0">
          <CreateManualBookingDrawer area={area} data={data.manualBooking} />
        </div>
      </div>

      <AdminPanel
        title={area === "owner" ? "Pracovní seznam rezervací" : "Rezervace k obsluze"}
        description="Hlavní rozhodnutí jsou nahoře: filtr, termín, stav a nejčastější akce v řádku."
        compact
        denseHeader
      >
        <div className="space-y-4">
          <AdminBookingsToolbar
            currentPath={data.currentPath}
            filters={data.filters}
            resultCount={data.summary.totalCount}
          />

          {data.groups.length > 0 ? (
            <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
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
                <span className="text-right">Akce</span>
              </div>

              <div className="divide-y divide-white/8">
                {data.groups.map((group) => (
                  <section key={group.key}>
                    <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-2.5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
                          {group.label}
                        </p>
                        <p className="mt-0.5 text-sm text-white/48">{group.detail}</p>
                      </div>
                      <p className="text-sm text-white/46">{group.items.length}</p>
                    </div>

                    <div className="divide-y divide-white/8">
                      {group.items.map((booking) => (
                        <article
                          key={booking.id}
                          className={cn(
                            "transition-colors hover:bg-white/[0.03]",
                            booking.isMuted && "bg-white/[0.015] text-white/70",
                          )}
                        >
                          <div
                            className={cn(
                              "hidden items-center gap-2 px-4 py-2.5 md:grid",
                              columnLayout,
                              booking.isMuted && "opacity-70",
                            )}
                          >
                            <InfoCell>
                              <p className="truncate text-[15px] font-medium leading-5 text-white">
                                {booking.title}
                              </p>
                              <p className="truncate text-xs text-white/54">{booking.serviceName}</p>
                            </InfoCell>

                            <InfoCell>
                              <p className="text-[15px] font-semibold leading-5 text-white">
                                {booking.scheduledTimeLabel}
                              </p>
                              <p className="text-xs text-white/52">{booking.scheduledDateLabel}</p>
                            </InfoCell>

                            <InfoCell className="md:justify-self-center">
                              <StatusBadge status={booking.status} muted={booking.isMuted}>
                                {booking.statusLabel}
                              </StatusBadge>
                            </InfoCell>

                            <InfoCell>
                              <SourceBadge muted={booking.isMuted}>{booking.sourceLabel}</SourceBadge>
                            </InfoCell>

                            <InfoCell>
                              <ContactBlock booking={booking} compact />
                            </InfoCell>

                            <div className="justify-self-end">
                              <AdminBookingsQuickActions
                                area={area}
                                bookingId={booking.id}
                                href={booking.href}
                                status={booking.status}
                                availableActions={booking.availableActions}
                              />
                            </div>
                          </div>

                          <div className={cn("px-4 py-3 md:hidden", booking.isMuted && "opacity-75")}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[15px] font-semibold leading-5 text-white">
                                  {booking.scheduledTimeLabel}
                                </p>
                                <p className="mt-1 text-xs text-white/52">{booking.scheduledDateShortLabel}</p>
                              </div>
                              <StatusBadge status={booking.status} muted={booking.isMuted}>
                                {booking.statusLabel}
                              </StatusBadge>
                            </div>

                            <div className="mt-3 min-w-0">
                              <p className="truncate text-[15px] font-medium text-white">{booking.title}</p>
                              <p className="truncate text-sm text-white/60">{booking.serviceName}</p>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <SourceBadge muted={booking.isMuted}>{booking.sourceLabel}</SourceBadge>
                            </div>

                            <div className="mt-3">
                              <ContactBlock booking={booking} />
                            </div>

                            <div className="mt-3 border-t border-white/8 pt-3">
                              <AdminBookingsQuickActions
                                area={area}
                                bookingId={booking.id}
                                href={booking.href}
                                status={booking.status}
                                availableActions={booking.availableActions}
                              />
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
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
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {stats.map((stat) => (
        <Link
          key={stat.key}
          href={stat.href}
          className={cn(
            "group rounded-[1rem] border px-3 py-2.5 transition hover:border-white/18 hover:bg-white/6",
            getStatToneClassName(stat.tone, stat.isActive),
          )}
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/46">{stat.label}</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <p className="text-sm font-semibold text-white">{stat.value}</p>
            <span className="text-[10px] uppercase tracking-[0.16em] text-white/34">
              {stat.isActive ? "Aktivní" : "Filtrovat"}
            </span>
          </div>
        </Link>
      ))}
    </section>
  );
}

function InfoCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0", className)}>{children}</div>;
}

function StatusBadge({
  status,
  muted,
  children,
}: {
  status: BookingStatus;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 max-w-full items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-1 text-center text-[11px] font-semibold leading-4 tracking-[0.01em]",
        getStatusClassName(status, muted ?? false),
      )}
    >
      {children}
    </span>
  );
}

function SourceBadge({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full rounded-full border border-white/10 bg-white/6 px-2 py-0.5 text-[10px] font-medium text-white/72",
        muted && "border-white/8 bg-white/[0.04] text-white/52",
      )}
    >
      {children}
    </span>
  );
}

function ContactBlock({
  booking,
  compact = false,
}: {
  booking: ReservationsDashboardData["groups"][number]["items"][number];
  compact?: boolean;
}) {
  return (
    <div className={cn("min-w-0", compact && "space-y-1")}>
      {booking.primaryContactLabel && booking.primaryContactHref ? (
        <a
          href={booking.primaryContactHref}
          className="block truncate text-sm font-medium text-white/84 transition hover:text-white"
        >
          {booking.primaryContactLabel}
        </a>
      ) : (
        <p className="text-sm text-white/42">Kontakt chybí</p>
      )}
      {booking.secondaryContactLabel && booking.secondaryContactHref ? (
        <a
          href={booking.secondaryContactHref}
          className="block truncate text-xs text-white/52 transition hover:text-white/72"
        >
          {booking.secondaryContactLabel}
        </a>
      ) : null}
    </div>
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
        : "Jakmile se objeví další termíny, ukážou se tady v kompaktním pracovním seznamu.";

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

function getStatusClassName(status: BookingStatus, muted: boolean) {
  if (muted) {
    switch (status) {
      case BookingStatus.COMPLETED:
        return "border-emerald-300/16 bg-emerald-400/8 text-emerald-100/70";
      case BookingStatus.CANCELLED:
        return "border-red-300/14 bg-red-400/8 text-red-100/68";
      default:
        return "border-white/10 bg-white/6 text-white/74";
    }
  }

  switch (status) {
    case BookingStatus.PENDING:
      return "border-amber-300/38 bg-amber-400/12 text-amber-100";
    case BookingStatus.COMPLETED:
      return "border-emerald-300/35 bg-emerald-400/12 text-emerald-100";
    case BookingStatus.CANCELLED:
      return "border-red-300/24 bg-red-400/10 text-red-100";
    case BookingStatus.CONFIRMED:
      return "border-sky-300/30 bg-sky-400/12 text-sky-100";
    case BookingStatus.NO_SHOW:
      return "border-rose-300/32 bg-rose-400/12 text-rose-100";
  }
}

function getStatToneClassName(
  tone: ReservationsDashboardData["stats"][number]["tone"],
  isActive: boolean,
) {
  if (isActive) {
    return "border-[var(--color-accent)]/58 bg-[rgba(190,160,120,0.18)] shadow-[0_0_0_1px_rgba(190,160,120,0.22)]";
  }

  switch (tone) {
    case "accent":
      return "border-[var(--color-accent)]/28 bg-[rgba(190,160,120,0.08)]";
    case "muted":
      return "border-white/10 bg-white/4";
    default:
      return "border-white/10 bg-black/12";
  }
}
