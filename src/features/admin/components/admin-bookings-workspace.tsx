"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { type AdminArea } from "@/config/navigation";
import { type ReservationsDashboardData } from "@/features/admin/lib/admin-data";
import { cn } from "@/lib/utils";

import { AdminBookingsQuickActions } from "./admin-bookings-quick-actions";

type AdminBookingsWorkspaceProps = {
  area: AdminArea;
  data: ReservationsDashboardData;
};

const columnLayout =
  "md:grid-cols-[minmax(14rem,2fr)_minmax(9rem,0.95fr)_minmax(8.5rem,0.9fr)_minmax(6rem,0.7fr)_minmax(11rem,1.05fr)_minmax(10rem,0.95fr)]";

export function AdminBookingsWorkspace({
  area,
  data,
}: AdminBookingsWorkspaceProps) {
  const router = useRouter();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);
  const flatRows = data.groups.flatMap((group) => group.items);
  const rowIndexById = new Map(flatRows.map((item, index) => [item.id, index]));

  function moveFocus(index: number) {
    const next = rowRefs.current[index];
    next?.focus();
  }

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToastMessage(null);
    }, 2600);

    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
        <div
          className={cn(
            "sticky top-[5.1rem] z-20 hidden items-center gap-3 border-b border-white/10 bg-[rgba(10,9,8,0.96)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40 backdrop-blur md:grid",
            columnLayout,
          )}
        >
          <span>Rezervace</span>
          <span>Termín</span>
          <span>Status</span>
          <span>Zdroj</span>
          <span>Kontakt</span>
          <span className="text-right">Akce</span>
        </div>

        <div className="divide-y divide-white/8">
          {data.groups.map((group) => (
            <section key={group.key}>
              <div
                className={cn(
                  "flex items-center justify-between gap-3 border-b border-white/8 px-4 py-2.5",
                  group.key === "pending"
                    ? "bg-[linear-gradient(90deg,rgba(190,160,120,0.14),rgba(255,255,255,0.04))]"
                    : "bg-white/[0.03]",
                )}
              >
                <div>
                  <p
                    className={cn(
                      "text-xs font-semibold uppercase tracking-[0.2em]",
                      group.key === "pending" ? "text-amber-100" : "text-[var(--color-accent-soft)]",
                    )}
                  >
                    {group.label}
                  </p>
                  <p className="mt-0.5 text-sm text-white/48">{group.detail}</p>
                </div>
                <p className="text-sm text-white/46">{group.items.length}</p>
              </div>

              <div className="relative divide-y divide-white/8 before:hidden before:content-[''] md:before:block md:before:h-11">
                {group.items.map((booking) => {
                  const rowIndex = rowIndexById.get(booking.id) ?? 0;

                  return (
                    <article
                      key={booking.id}
                      className={cn(
                        "relative transition-colors",
                        booking.isPending
                          ? "bg-amber-400/[0.05]"
                          : booking.isMuted
                            ? "bg-white/[0.015] text-white/70"
                            : "hover:bg-white/[0.03]",
                      )}
                    >
                      {booking.isPending ? (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-0 left-0 w-[3px] bg-amber-300/60"
                        />
                      ) : null}
                      <div
                        ref={(element) => {
                          rowRefs.current[rowIndex] = element;
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Otevřít detail rezervace ${booking.title}`}
                        onClick={() => router.push(booking.href)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(booking.href);
                          }

                          if (event.key === "ArrowDown") {
                            event.preventDefault();
                            moveFocus(Math.min(rowRefs.current.length - 1, rowIndex + 1));
                          }

                          if (event.key === "ArrowUp") {
                            event.preventDefault();
                            moveFocus(Math.max(0, rowIndex - 1));
                          }
                        }}
                        className={cn(
                          "cursor-pointer outline-none transition-colors focus-visible:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/45 hover:bg-white/[0.03]",
                          booking.isPending && "hover:bg-amber-400/[0.08]",
                          booking.isMuted && "opacity-70",
                        )}
                      >
                        <div className={cn("hidden items-center gap-3 px-4 py-2.5 md:grid", columnLayout)}>
                          <InfoCell>
                            <p className="truncate text-[15px] font-medium leading-5 text-white">
                              {booking.title}
                            </p>
                            <p className="truncate text-xs text-white/54">{booking.serviceName}</p>
                          </InfoCell>

                          <InfoCell>
                            <p className="text-sm font-semibold leading-5 text-white">
                              {booking.scheduledTimeLabel}
                            </p>
                            <p className="mt-0.5 text-xs text-white/50">{booking.scheduledDateLabel}</p>
                          </InfoCell>

                          <InfoCell>
                            <StatusBadge status={booking.status} muted={booking.isMuted} pending={booking.isPending}>
                              {booking.statusLabel}
                            </StatusBadge>
                          </InfoCell>

                          <InfoCell>
                            <SourceBadge muted={booking.isMuted}>{booking.sourceLabel}</SourceBadge>
                          </InfoCell>

                          <InfoCell>
                            <ContactBlock booking={booking} compact />
                          </InfoCell>

                          <div className="justify-self-stretch self-center" data-row-interactive>
                            <AdminBookingsQuickActions
                              area={area}
                              bookingId={booking.id}
                              href={booking.href}
                              status={booking.status}
                              availableActions={booking.availableActions}
                              onSuccess={setToastMessage}
                            />
                          </div>
                        </div>

                        <div className={cn("px-4 py-3 md:hidden", booking.isMuted && "opacity-75")}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-5 text-white">
                                {booking.scheduledTimeLabel}
                              </p>
                              <p className="mt-0.5 text-xs text-white/50">{booking.scheduledDateShortLabel}</p>
                            </div>

                            <StatusBadge status={booking.status} muted={booking.isMuted} pending={booking.isPending}>
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

                          <div className="mt-3 border-t border-white/8 pt-3" data-row-interactive>
                            <AdminBookingsQuickActions
                              area={area}
                              bookingId={booking.id}
                              href={booking.href}
                              status={booking.status}
                              availableActions={booking.availableActions}
                              onSuccess={setToastMessage}
                            />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {toastMessage ? <Toast message={toastMessage} onClose={() => setToastMessage(null)} /> : null}
    </div>
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
  pending,
  children,
}: {
  status: ReservationsDashboardData["groups"][number]["items"][number]["status"];
  muted?: boolean;
  pending?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 min-w-[7.75rem] max-w-full items-center justify-center whitespace-nowrap rounded-full border px-2.5 py-1 text-center text-[11px] font-semibold leading-4 tracking-[0.01em]",
        getStatusClassName(status, muted ?? false, pending ?? false),
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
  const isPhone = booking.primaryContactHref?.startsWith("tel:");
  const secondaryLabel = booking.secondaryContactLabel;

  return (
    <div className={cn("min-w-0", compact && "space-y-1")}>
      {booking.primaryContactLabel && booking.primaryContactHref ? (
        <a
          href={booking.primaryContactHref}
          title={secondaryLabel ? `Další kontakt: ${secondaryLabel}` : undefined}
          data-row-interactive
          onClick={(event) => event.stopPropagation()}
          className="inline-flex max-w-full items-center gap-2 truncate text-sm font-medium text-white/84 transition hover:text-white"
        >
          <ContactIcon phone={Boolean(isPhone)} />
          <span className="truncate">{booking.primaryContactLabel}</span>
        </a>
      ) : (
        <p className="text-sm text-white/42">bez kontaktu</p>
      )}
    </div>
  );
}

function ContactIcon({ phone }: { phone: boolean }) {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center text-white/58">
      {phone ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.4]">
          <path d="M5.2 2.5h1.6l.6 3-1.1 1.1a9.2 9.2 0 0 0 3.1 3.1l1.1-1.1 3 .6v1.6c0 .4-.3.7-.7.7A10.4 10.4 0 0 1 2.5 3.2c0-.4.3-.7.7-.7Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.4]">
          <path d="M2.5 4.5 8 8.5l5.5-4" />
          <rect x="2.5" y="3.5" width="11" height="9" rx="1.8" />
        </svg>
      )}
    </span>
  );
}

function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-[1rem] border border-emerald-300/18 bg-[#17141b]/95 px-4 py-3 text-sm text-white shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur"
    >
      <span className="text-emerald-300">Hotovo</span>
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/72 transition hover:border-white/18 hover:text-white"
      >
        Zavřít
      </button>
    </div>
  );
}

function getStatusClassName(
  status: ReservationsDashboardData["groups"][number]["items"][number]["status"],
  muted: boolean,
  pending: boolean,
) {
  if (pending) {
    return "border-amber-300/48 bg-amber-400/18 text-amber-50";
  }

  if (muted) {
    switch (status) {
      case "COMPLETED":
        return "border-emerald-300/16 bg-emerald-400/8 text-emerald-100/70";
      case "CANCELLED":
        return "border-red-300/14 bg-red-400/8 text-red-100/68";
      default:
        return "border-white/10 bg-white/6 text-white/74";
    }
  }

  switch (status) {
    case "CONFIRMED":
      return "border-sky-300/28 bg-sky-400/10 text-sky-100";
    case "COMPLETED":
      return "border-emerald-300/26 bg-emerald-400/10 text-emerald-100";
    case "CANCELLED":
      return "border-red-300/22 bg-red-400/10 text-red-100";
    case "NO_SHOW":
      return "border-rose-300/28 bg-rose-400/10 text-rose-100";
    default:
      return "border-white/10 bg-white/6 text-white/74";
  }
}
