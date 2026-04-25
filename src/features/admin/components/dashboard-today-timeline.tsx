"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { type AdminArea } from "@/config/navigation";
import { AdminBookingsQuickActions } from "@/features/admin/components/admin-bookings-quick-actions";
import { type DashboardTimelineItem } from "@/features/admin/lib/admin-dashboard";
import { cn } from "@/lib/utils";

type DashboardTodayTimelineProps = {
  area: AdminArea;
  items: DashboardTimelineItem[];
};

export function DashboardTodayTimeline({ area, items }: DashboardTodayTimelineProps) {
  const router = useRouter();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToastMessage(null);
    }, 2600);

    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  function openItem(href: string) {
    router.push(href);
  }

  return (
    <>
      <div className="px-5 py-2 sm:px-6 xl:px-7">
        {items.map((item, index) => {
          const isBooking = item.kind === "booking";

          return (
            <article
              key={item.id}
              role="link"
              tabIndex={0}
              onClick={() => openItem(item.href)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openItem(item.href);
                }
              }}
              className={cn(
                "group relative grid cursor-pointer gap-4 rounded-[1.15rem] px-3 py-4 transition outline-none hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55 sm:px-4 md:grid-cols-[136px_minmax(0,1fr)_auto] md:items-center md:gap-5 md:py-5",
                index < items.length - 1 && "border-b border-white/5",
                isBooking ? "hover:border-white/8" : "hover:border-emerald-300/10",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="relative flex min-h-full items-center pl-4 text-sm font-semibold tracking-[0.02em] text-white/84 before:absolute before:left-0 before:top-0 before:h-full before:w-px before:bg-white/10">
                  <span>{item.timeLabel}</span>
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-[15px] font-medium text-white">{item.title}</p>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em]",
                      isBooking
                        ? item.bookingStatus === "PENDING"
                          ? "border-amber-300/35 bg-amber-400/12 text-amber-100"
                          : "border-violet-400/25 bg-violet-400/10 text-violet-200"
                        : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
                    )}
                  >
                    {isBooking ? item.bookingStatusLabel : "Volné okno"}
                  </span>
                </div>
                <p className="truncate pt-1 text-sm text-white/54">{item.subtitle}</p>
              </div>

              <div
                className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
                onClick={(event) => event.stopPropagation()}
              >
                {isBooking ? (
                  <AdminBookingsQuickActions
                    area={area}
                    bookingId={item.bookingId}
                    href={item.href}
                    status={item.bookingStatus}
                    availableActions={item.availableActions}
                    onSuccess={setToastMessage}
                  />
                ) : (
                  <>
                    <Link
                      href={item.createHref}
                      className="inline-flex min-h-8 min-w-[9rem] items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-medium text-emerald-50 transition hover:bg-emerald-400/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/45"
                    >
                      Vytvořit rezervaci
                    </Link>
                    <Link
                      href={item.editHref}
                      className="inline-flex min-h-8 min-w-[7rem] items-center justify-center rounded-full border border-white/12 px-3 py-1 text-[11px] font-medium text-white/72 transition hover:border-white/24 hover:bg-white/7 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55"
                    >
                      Upravit slot
                    </Link>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {toastMessage ? <Toast message={toastMessage} onClose={() => setToastMessage(null)} /> : null}
    </>
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
