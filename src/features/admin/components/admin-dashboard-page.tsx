import Link from "next/link";

import { AnalyticsWidget } from "@/components/admin/AnalyticsWidget";
import { env } from "@/config/env";
import { cn } from "@/lib/utils";

import { type AdminDashboardData } from "../lib/admin-dashboard";

type DashboardPageProps = {
  data: AdminDashboardData;
};

type DashboardIconName =
  | "warning"
  | "problem"
  | "success"
  | "plus"
  | "calendar"
  | "booking"
  | "clients";

function DashboardIcon({
  name,
  className,
}: {
  name: DashboardIconName;
  className?: string;
}) {
  const sharedProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };

  switch (name) {
    case "warning":
      return (
        <svg {...sharedProps}>
          <path d="M12 3 3 19.5h18L12 3Z" />
          <path d="M12 9v4.5" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "problem":
      return (
        <svg {...sharedProps}>
          <path d="M12 4a8 8 0 1 1 0 16a8 8 0 0 1 0-16Z" />
          <path d="M15 9 9 15" />
          <path d="m9 9 6 6" />
        </svg>
      );
    case "success":
      return (
        <svg {...sharedProps}>
          <path d="M12 4a8 8 0 1 1 0 16a8 8 0 0 1 0-16Z" />
          <path d="m8.5 12.5 2.3 2.3 4.7-5.3" />
        </svg>
      );
    case "plus":
      return (
        <svg {...sharedProps}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...sharedProps}>
          <path d="M7 4v3" />
          <path d="M17 4v3" />
          <path d="M4 9h16" />
          <rect x="4" y="6" width="16" height="14" rx="3" />
        </svg>
      );
    case "booking":
      return (
        <svg {...sharedProps}>
          <path d="M12 7v5l3 2" />
          <path d="M12 4a8 8 0 1 1 0 16a8 8 0 0 1 0-16Z" />
        </svg>
      );
    case "clients":
      return (
        <svg {...sharedProps}>
          <path d="M8 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6Z" />
          <path d="M16 12a2.5 2.5 0 1 0 0-5a2.5 2.5 0 0 0 0 5Z" />
          <path d="M4.5 18a4.5 4.5 0 0 1 7 0" />
          <path d="M13 18a3.8 3.8 0 0 1 6.5-.5" />
        </svg>
      );
  }
}

function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.05rem] border border-white/7 bg-zinc-900/88 shadow-[0_12px_32px_rgba(0,0,0,0.16)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function DashboardButton({
  href,
  label,
  tone = "secondary",
}: {
  href: string;
  label: string;
  tone?: "primary" | "secondary" | "outline";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-9 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
        tone === "primary" &&
          "border border-[var(--color-accent)]/50 bg-[rgba(190,160,120,0.16)] text-white shadow-[0_8px_20px_rgba(0,0,0,0.16)] hover:border-[var(--color-accent)]/70 hover:bg-[rgba(190,160,120,0.24)]",
        tone === "secondary" &&
          "border border-white/9 bg-white/[0.045] text-white/88 hover:border-white/16 hover:bg-white/[0.08]",
        tone === "outline" &&
          "border border-white/14 bg-transparent text-white hover:border-[var(--color-accent)]/45 hover:bg-white/[0.05]",
      )}
    >
      {label}
    </Link>
  );
}

function DashboardBadge({
  tone,
  children,
}: {
  tone: "green" | "purple" | "gold" | "warning";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]",
        tone === "green" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
        tone === "purple" && "border-violet-400/25 bg-violet-400/10 text-violet-200",
        tone === "gold" &&
          "border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.12)] text-[var(--color-accent-soft)]",
        tone === "warning" && "border-amber-300/30 bg-amber-400/10 text-amber-100",
      )}
    >
      {children}
    </span>
  );
}

function getCompactTodayStatus(data: AdminDashboardData) {
  if (data.todayBookingsCount === 0) {
    return "Žádná aktivní rezervace";
  }

  if (data.todayBookingsCount === 1) {
    return "1 aktivní rezervace";
  }

  return `${data.todayBookingsCount} aktivní rezervace`;
}

function getCompactNextStatus(data: AdminDashboardData) {
  if (data.nextClient) {
    return `další ${data.nextClient.timeRangeLabel}`;
  }

  return data.todayBookingsCount > 0 ? "další klientka dnes už není" : "dnes zatím bez rezervace";
}

function getCompactCurrentStatus(value: string) {
  return value
    .replace(/^Právě probíhá:\s*/u, "Právě probíhá ")
    .replace(/\.$/u, "");
}

export function DashboardPage({ data }: DashboardPageProps) {
  const analyticsEnabled = Boolean(
    env.MATOMO_URL && env.MATOMO_SITE_ID && env.MATOMO_AUTH_TOKEN,
  );

  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-[1600px] px-0.5 py-0.5 sm:px-1 sm:py-1 lg:px-1">
      <div className="space-y-4">
        <DashboardTodayHero data={data} />
        <DashboardAttentionAlert data={data} />
        <DashboardKpiGrid data={data} />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <main className="min-w-0 space-y-4">
            <DashboardTodayTimelineSection data={data} />
            <DashboardAvailableSlots data={data} />
          </main>

          <RightSidebar data={data} analyticsEnabled={analyticsEnabled} />
        </div>
      </div>
    </div>
  );
}

export function DashboardTodayHero({ data }: DashboardPageProps) {
  return (
    <Card className="overflow-hidden p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-base font-semibold text-white">Dnešní provoz</h1>
            <span className="text-sm font-medium text-white/52">{data.todayLabel}</span>
          </div>

          <p className="mt-1 truncate text-sm text-white/72">
            {getCompactTodayStatus(data)} · {getCompactNextStatus(data)}
          </p>

          {data.currentReservationSummary ? (
            <p className="mt-1 truncate text-sm font-medium text-[var(--color-accent-soft)]">
              {getCompactCurrentStatus(data.currentReservationSummary)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
          {data.nextClient ? (
            <Link
              href={data.nextClient.detailHref}
              className="flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-lg border border-white/9 bg-white/[0.035] px-3 py-2 transition hover:border-[var(--color-accent)]/28 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55 sm:min-w-[17rem]"
            >
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
                  Další rezervace
                </span>
                <span className="block truncate text-sm font-medium text-white">
                  {data.nextClient.timeRangeLabel} · {data.nextClient.serviceName}
                </span>
                <span className="block truncate text-xs text-white/52">{data.nextClient.clientName}</span>
              </span>
              <span className="text-xs font-semibold text-[var(--color-accent-soft)]">Otevřít</span>
            </Link>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <DashboardButton href={data.createBookingHref} label="Vytvořit rezervaci" tone="primary" />
            <DashboardButton href={data.timelineFooterHref} label="Dnešní plán" />
            <DashboardButton href={data.upcomingSlotsFooterHref} label="Dostupnost" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function DashboardTodayTasks({ data }: DashboardPageProps) {
  return (
    <div className="rounded-[1.3rem] border border-white/8 bg-black/18 p-4 sm:p-5">
      <div className="flex flex-col gap-2 border-b border-white/7 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/42">
            Dnešní úkoly
          </p>
          <p className="mt-1 text-sm text-white/58">Krátké priority pro dnešní směnu.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.todayTasks.map((task) => (
          <article
            key={task.id}
            className={cn(
              "rounded-[1rem] border px-4 py-3",
              task.tone === "warning" && "border-amber-300/16 bg-amber-400/8",
              task.tone === "success" && "border-emerald-300/14 bg-emerald-400/8",
              task.tone === "neutral" && "border-white/8 bg-white/[0.03]",
            )}
          >
            <p className="text-sm font-medium leading-6 text-white">{task.label}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export function DashboardAttentionAlert({ data }: DashboardPageProps) {
  const actionableAlerts = data.alerts.filter((alert) => alert.emphasis !== "ok");
  const okAlert = data.alerts.find((alert) => alert.emphasis === "ok") ?? null;

  return (
    <Card
      className={cn(
        "p-3.5 sm:p-4",
        actionableAlerts.length > 0
          ? "border-amber-300/16 bg-[linear-gradient(135deg,rgba(120,53,15,0.18),rgba(24,24,27,0.92))]"
          : "border-emerald-300/12 bg-emerald-500/8",
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "rounded-lg border p-2",
            actionableAlerts.length > 0
              ? "border-amber-300/18 bg-black/14 text-amber-100"
              : "border-emerald-300/16 bg-black/12 text-emerald-100",
          )}
        >
          <DashboardIcon
            name={actionableAlerts.length > 0 ? "warning" : "success"}
            className="size-4"
          />
        </span>
          <h2 className="text-sm font-semibold text-white">Vyžaduje pozornost</h2>
        </div>

      {actionableAlerts.length > 0 ? (
          <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-3">
          {actionableAlerts.map((alert) => (
            <SecondaryAlertCard
              key={alert.id}
              tone={alert.tone}
              text={alert.text}
              href={alert.href}
              actionLabel={alert.actionLabel}
            />
          ))}
        </div>
      ) : (
          <p className="min-w-0 flex-1 text-sm font-medium text-emerald-50">
          {okAlert?.text ?? "Vše je připravené. Žádná položka teď nevyžaduje pozornost."}
        </p>
      )}
      </div>
    </Card>
  );
}

function SecondaryAlertCard({
  tone,
  text,
  href,
  actionLabel,
}: {
  tone: "warning" | "problem" | "success";
  text: string;
  href: string;
  actionLabel: string;
}) {
  const toneStyles = {
    warning: "border-amber-400/20 bg-amber-400/8 text-amber-100",
    problem: "border-orange-400/20 bg-orange-400/8 text-orange-100",
    success: "border-emerald-400/20 bg-emerald-400/8 text-emerald-100",
  } as const;

  const toneIcons = {
    warning: "warning",
    problem: "problem",
    success: "success",
  } as const;

  return (
    <article className={cn("rounded-lg border px-3 py-2", toneStyles[tone])}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-lg border border-current/15 bg-black/10 p-1.5">
            <DashboardIcon name={toneIcons[tone]} className="size-4" />
          </span>
          <p className="truncate text-sm font-medium">{text}</p>
        </div>

        <Link
          href={href}
          className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-md border border-current/20 px-2.5 py-1 text-xs font-semibold text-current transition hover:bg-black/10"
        >
          {alertActionLabel(actionLabel)}
        </Link>
      </div>
    </article>
  );
}

function alertActionLabel(label: string) {
  return label.includes("Upravit") ? "Upravit" : "Otevřít";
}

export function DashboardTodayTimelineSection({ data }: DashboardPageProps) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-white/7 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Dnešní plán</h2>
          </div>
          <DashboardBadge tone="gold">{data.todayLabel}</DashboardBadge>
        </div>
      </div>

      {data.todayPlanItems.length > 0 ? (
        <div className="px-3 py-1.5 sm:px-4">
          {data.todayPlanItems.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "grid min-h-14 gap-2 rounded-lg px-2.5 py-2.5 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55 sm:px-3 md:grid-cols-[112px_minmax(0,1fr)_auto] md:items-center",
                index < data.todayPlanItems.length - 1 && "border-b border-white/5",
                item.isCurrent && "border border-[var(--color-accent)]/24 bg-[rgba(190,160,120,0.10)]",
                item.isCompleted && "opacity-68",
              )}
            >
              <p className="text-sm font-semibold tracking-[0.02em] text-white/82">{item.timeLabel}</p>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-white">{item.serviceName}</p>
                <p className="truncate text-xs text-white/50">{item.clientName}</p>
                {item.notes.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {item.notes.map((note) => (
                      <p key={note.label} className="truncate text-xs leading-5 text-white/58">
                        <span className="font-medium text-white/72">{note.label}:</span> {note.value}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                    item.isCompleted
                      ? "border-emerald-300/18 bg-emerald-400/7 text-emerald-100/70"
                      : item.isCurrent
                        ? "border-[var(--color-accent)]/35 bg-[rgba(190,160,120,0.14)] text-[var(--color-accent-soft)]"
                        : "border-violet-400/25 bg-violet-400/10 text-violet-200",
                  )}
                >
                  {item.statusLabel}
                </span>
                <span className="text-sm font-medium text-[var(--color-accent-soft)]">Otevřít</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="px-4 py-5">
          <p className="text-base font-medium text-white">Dnes zatím není žádná rezervace.</p>
          <div className="mt-3">
            <DashboardButton href={data.createBookingHref} label="Vytvořit rezervaci" />
          </div>
        </div>
      )}

      <div className="border-t border-white/7 px-4 py-3">
        <Link
          href={data.timelineFooterHref}
          className="text-sm font-medium text-[var(--color-accent-soft)] transition hover:text-white"
        >
          Otevřít dnešní plán
        </Link>
      </div>
    </Card>
  );
}

export function DashboardKpiGrid({ data }: DashboardPageProps) {
  return (
    <Card className="grid gap-0 overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
      {data.kpis.map((item, index) => (
        <article
          key={item.label}
          className={cn(
            "border-white/7 px-4 py-3",
            index < data.kpis.length - 1 && "border-b",
            index % 2 === 1 && "sm:border-l",
            index > 1 && "sm:border-b-0",
            index > 0 && "xl:border-l",
            "xl:border-b-0",
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/34">
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-white/88">{item.value}</p>
        </article>
      ))}
    </Card>
  );
}

export function RightSidebar({
  data,
  analyticsEnabled,
}: DashboardPageProps & { analyticsEnabled: boolean }) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-4">
      <DashboardQuickActions data={data} />
      <DashboardWeekSummary data={data} />
      <AnalyticsWidget enabled={analyticsEnabled} />
    </aside>
  );
}

export function DashboardAvailableSlots({ data }: DashboardPageProps) {
  return (
    <Card className="p-4">
      <div className="border-b border-white/7 pb-3">
        <h2 className="text-base font-semibold text-white">Nejbližší volné termíny</h2>
      </div>

      <div className="space-y-2.5 pt-3">
        {data.upcomingSlots.length > 0 ? (
          <>
            {!data.hasFreeWindowsToday ? (
              <p className="rounded-lg border border-white/8 bg-black/16 px-3 py-2.5 text-sm font-medium text-white/72">
                {data.hasPublishedSlotsTodayOrTomorrow
                  ? "Dnes nejsou volná okna."
                  : "Dnes ani zítra není publikovaný volný termín."}
              </p>
            ) : null}

            {data.upcomingSlots.map((slot, index) => (
              <Link
                key={slot.id}
                href={slot.href}
                className={cn(
                  "group flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55",
                  index < data.upcomingSlots.length - 1 && "border-b border-white/5",
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-white">{slot.timeLabel}</p>
                    <span className="text-xs uppercase tracking-[0.18em] text-white/38">
                      {slot.dayLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/54">{slot.metaLabel}</p>
                </div>
                <span className="text-xl text-white/32 transition group-hover:text-white/56">→</span>
              </Link>
            ))}
          </>
        ) : (
          <div>
            <p className="text-sm font-medium text-white">
              {data.hasPublishedSlotsTodayOrTomorrow
                ? "Dnes nejsou volná okna."
                : "Dnes ani zítra není publikovaný volný termín."}
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <DashboardButton href={data.upcomingSlotsFooterHref} label="Upravit dostupnost" />
              <DashboardButton href={data.addSlotHref} label="Přidat termín" tone="outline" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/7 pt-3">
        <Link
          href={data.upcomingSlotsFooterHref}
          className="text-sm font-medium text-[var(--color-accent-soft)] transition hover:text-white"
        >
          Zobrazit všechny termíny
        </Link>
      </div>
    </Card>
  );
}

export function DashboardQuickActions({ data }: DashboardPageProps) {
  return (
    <Card className="p-4">
      <div className="border-b border-white/7 pb-3">
        <h2 className="text-base font-semibold text-white">Rychlé akce</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3">
          {data.quickActions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className={cn(
                "group flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55",
                action.id === "create-booking"
                  ? "border-[var(--color-accent)]/28 bg-[rgba(190,160,120,0.12)] hover:border-[var(--color-accent)]/42 hover:bg-[rgba(190,160,120,0.18)]"
                  : "border-white/8 bg-white/[0.035] hover:border-white/14 hover:bg-white/[0.06]",
              )}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/18 text-[var(--color-accent-soft)] transition group-hover:border-[var(--color-accent)]/25">
                <DashboardIcon name={action.icon} className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{quickActionLabel(action.id)}</p>
              </div>
            </Link>
          ))}
      </div>
    </Card>
  );
}

function quickActionLabel(id: string) {
  switch (id) {
    case "create-booking":
      return "Vytvořit";
    case "bookings":
      return "Rezervace";
    case "availability":
      return "Dostupnost";
    case "clients":
      return "Klienti";
    default:
      return "Otevřít";
  }
}

export function DashboardWeekSummary({ data }: DashboardPageProps) {
  return (
    <Card className="p-4">
      <div className="border-b border-white/7 pb-3">
        <h2 className="text-base font-semibold text-white">Tento týden</h2>
      </div>

      <div className="grid gap-2 pt-3">
        <SummaryRow label="Obsazenost" value={data.weekSummary.occupancyLabel} />
        <SummaryRow label="Volné sloty" value={data.weekSummary.freeSlotsLabel} />
        <SummaryRow label="Rezervace" value={data.weekSummary.bookingsLabel} />
      </div>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 rounded-lg border border-white/8 bg-white/[0.035] px-3 py-2">
      <p className="text-sm text-white/58">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-[1600px] animate-pulse px-0.5 py-0.5 sm:px-1 sm:py-1 lg:px-1">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_336px]">
        <main className="min-w-0 space-y-6">
          <div className="rounded-[1.65rem] border border-white/7 bg-zinc-900/88 p-6">
            <div className="h-5 w-28 rounded-full bg-white/10" />
            <div className="mt-5 h-16 w-36 rounded-2xl bg-white/10" />
            <div className="mt-4 h-4 w-64 rounded-full bg-white/10" />
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 rounded-[1rem] bg-white/8" />
              ))}
            </div>
          </div>

          <div className="h-24 rounded-[1.65rem] border border-white/7 bg-zinc-900/88" />

          <div className="rounded-[1.65rem] border border-white/7 bg-zinc-900/88">
            <div className="h-24 border-b border-white/7 bg-white/[0.02]" />
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "grid gap-4 px-5 py-5 md:grid-cols-[132px_minmax(0,1fr)_auto]",
                    index < 4 && "border-b border-white/5",
                  )}
                >
                  <div className="h-6 rounded-full bg-white/8" />
                  <div className="space-y-2">
                    <div className="h-5 rounded-full bg-white/8" />
                    <div className="h-4 w-2/3 rounded-full bg-white/8" />
                  </div>
                  <div className="h-10 w-40 rounded-full bg-white/8" />
                </div>
              ))}
            </div>
          </div>
        </main>

        <aside className="space-y-5">
          <div className="h-72 rounded-[1.65rem] border border-white/7 bg-zinc-900/88" />
          <div className="h-80 rounded-[1.65rem] border border-white/7 bg-zinc-900/88" />
        </aside>
      </div>
    </div>
  );
}
