import Link from "next/link";

import { cn } from "@/lib/utils";

import { type AdminDashboardData } from "../lib/admin-dashboard";

type DashboardPageProps = {
  data: AdminDashboardData;
};

type DashboardIconName = "warning" | "problem" | "success" | "plus" | "calendar" | "booking" | "clients";

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
        "rounded-2xl border border-white/10 bg-zinc-900/90 shadow-lg shadow-black/10",
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
        "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
        tone === "primary" &&
          "border border-[var(--color-accent)]/50 bg-[rgba(110,86,207,0.18)] text-white hover:border-[var(--color-accent)]/70 hover:bg-[rgba(110,86,207,0.24)]",
        tone === "secondary" &&
          "border border-white/10 bg-white/5 text-white/88 hover:border-white/16 hover:bg-white/8",
        tone === "outline" &&
          "border border-white/16 bg-transparent text-white hover:border-[var(--color-accent)]/45 hover:bg-white/5",
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
  tone: "green" | "purple" | "gold";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]",
        tone === "green" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
        tone === "purple" && "border-violet-400/25 bg-violet-400/10 text-violet-200",
        tone === "gold" && "border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.12)] text-[var(--color-accent-soft)]",
      )}
    >
      {children}
    </span>
  );
}

export function DashboardPage({ data }: DashboardPageProps) {
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-6">
          <TodayHeroCard data={data} />
          <AlertsRow data={data} />
          <TodayTimeline data={data} />
          <KPIGrid data={data} />
        </main>

        <RightSidebar data={data} />
      </div>
    </div>
  );
}

export function TodayHeroCard({ data }: DashboardPageProps) {
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[var(--color-accent-soft)]">{data.todayLabel}</p>
            <div className="flex items-end gap-4">
              <span className="text-6xl font-bold leading-none text-white">{data.todayBookingsCount}</span>
              <span className="pb-2 text-sm text-white/55">rezervace</span>
            </div>
            <p className="text-sm text-white/65">{data.nextReservationSummary}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <DashboardButton href={data.timelineFooterHref} label="Otevřít dnešní plán" tone="primary" />
            <DashboardButton href={`${data.timelineFooterHref}/novy`} label="Přidat termín" />
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-5 xl:w-[320px]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
            Další klientka
          </p>

          {data.nextClient ? (
            <div className="mt-4 space-y-4">
              <div className="space-y-1">
                <p className="text-3xl font-bold text-white">{data.nextClient.timeLabel}</p>
                <p className="text-sm text-white/78">{data.nextClient.serviceName}</p>
                <p className="text-base font-medium text-white">{data.nextClient.clientName}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <DashboardButton href={data.nextClient.detailHref} label="Detail" />
                <DashboardButton href={data.nextClient.editHref} label="Upravit" tone="outline" />
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-1">
              <p className="text-base font-medium text-white">Zatím nic v pořadí</p>
              <p className="text-sm text-white/58">Jakmile přijde další dnešní rezervace, objeví se tady.</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function AlertsRow({ data }: DashboardPageProps) {
  const toneStyles = {
    warning:
      "border-amber-400/20 bg-amber-400/8 text-amber-100",
    problem:
      "border-orange-400/20 bg-orange-400/8 text-orange-100",
    success:
      "border-emerald-400/20 bg-emerald-400/8 text-emerald-100",
  } as const;

  const toneIcons = {
    warning: "warning",
    problem: "problem",
    success: "success",
  } as const;

  return (
    <div className={cn("grid gap-4", data.alerts.length === 1 ? "grid-cols-1" : "md:grid-cols-3")}>
      {data.alerts.map((alert) => (
        <Card key={alert.id} className={cn("p-4", toneStyles[alert.tone])}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 rounded-xl border border-current/15 bg-black/10 p-2">
                <DashboardIcon name={toneIcons[alert.tone]} className="size-4" />
              </span>
              <p className="text-sm font-medium leading-6">{alert.text}</p>
            </div>

            <Link
              href={alert.href}
              className="shrink-0 rounded-lg border border-current/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-current transition hover:bg-black/10"
            >
              Otevřít
            </Link>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TodayTimeline({ data }: DashboardPageProps) {
  return (
    <Card className="p-6">
      <div className="border-b border-white/8 pb-4">
        <h2 className="text-xl font-semibold text-white">Dnešní plán</h2>
      </div>

      <div className="pt-2">
        {data.timelineItems.length > 0 ? (
          data.timelineItems.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between",
                index < data.timelineItems.length - 1 && "border-b border-white/5",
              )}
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="w-24 shrink-0 text-sm font-medium text-white/78">{item.timeLabel}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{item.title}</p>
                  <p className="truncate text-sm text-white/52">{item.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <DashboardBadge tone={item.badge === "VOLNE" ? "green" : "purple"}>
                  {item.badge === "VOLNE" ? "VOLNÉ" : "REZERVACE"}
                </DashboardBadge>
                <DashboardButton href={item.href} label="Upravit" />
              </div>
            </div>
          ))
        ) : (
          <div className="py-6">
            <p className="text-base font-medium text-white">Dnešní plán je zatím prázdný.</p>
            <p className="mt-2 text-sm text-white/58">Přidej termín nebo otevři týdenní plán dostupností.</p>
          </div>
        )}
      </div>

      <div className="border-t border-white/8 pt-4">
        <Link
          href={data.timelineFooterHref}
          className="text-sm font-medium text-[var(--color-accent-soft)] transition hover:text-white"
        >
          Zobrazit celý den v rozvrhu
        </Link>
      </div>
    </Card>
  );
}

export function KPIGrid({ data }: DashboardPageProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {data.kpis.map((item) => (
        <article
          key={item.label}
          className="rounded-xl border border-white/5 bg-neutral-900 p-4 shadow-lg shadow-black/10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/46">{item.label}</p>
          <p className="mt-3 text-3xl font-bold text-white">{item.value}</p>
        </article>
      ))}
    </div>
  );
}

export function RightSidebar({ data }: DashboardPageProps) {
  return (
    <aside className="space-y-6">
      <QuickStats data={data} />

      <Card className="p-5">
        <Link
          href={data.pendingConfirmations.href}
          className="flex items-center justify-between gap-4 transition hover:text-white"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
              Čeká na potvrzení
            </p>
            <p className="mt-3 text-4xl font-bold text-white">{data.pendingConfirmations.count}</p>
          </div>
          <span className="text-2xl text-white/45">→</span>
        </Link>
      </Card>

      <UpcomingSlots data={data} />
      <QuickActions data={data} />
    </aside>
  );
}

export function QuickStats({ data }: DashboardPageProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {data.quickStats.map((item) => (
        <Card key={item.label} className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">{item.label}</p>
          <p className="mt-3 text-3xl font-bold text-white">{item.value}</p>
          <p className="mt-2 text-xs text-white/52">{item.detail}</p>
        </Card>
      ))}
    </div>
  );
}

export function UpcomingSlots({ data }: DashboardPageProps) {
  return (
    <Card className="p-5">
      <div className="border-b border-white/8 pb-4">
        <h2 className="text-base font-semibold text-white">Nejbližší volné sloty</h2>
      </div>

      <div className="space-y-4 pt-4">
        {data.upcomingSlots.length > 0 ? (
          data.upcomingSlots.map((slot, index) => (
            <div
              key={slot.id}
              className={cn(
                "space-y-3 pb-4",
                index < data.upcomingSlots.length - 1 && "border-b border-white/5",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{slot.dateTimeLabel}</p>
                  <p className="mt-1 text-xs text-white/52">{slot.capacityLabel}</p>
                </div>
                <DashboardBadge tone="gold">{slot.badge}</DashboardBadge>
              </div>
              <DashboardButton href={slot.href} label="Upravit" />
            </div>
          ))
        ) : (
          <div>
            <p className="text-sm font-medium text-white">Na dnes ani zítra není volný publikovaný termín.</p>
            <p className="mt-2 text-sm text-white/58">Další termíny přidej nebo otevři plán dostupnosti.</p>
          </div>
        )}
      </div>

      <div className="border-t border-white/8 pt-4">
        <Link
          href={data.upcomingSlotsFooterHref}
          className="text-sm font-medium text-[var(--color-accent-soft)] transition hover:text-white"
        >
          Zobrazit další termíny
        </Link>
      </div>
    </Card>
  );
}

export function QuickActions({ data }: DashboardPageProps) {
  return (
    <Card className="p-5">
      <div className="border-b border-white/8 pb-4">
        <h2 className="text-base font-semibold text-white">Rychlé akce</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-4">
        {data.quickActions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className="group flex min-h-28 flex-col justify-between rounded-xl border border-white/8 bg-white/[0.03] p-4 transition hover:border-[var(--color-accent)]/30 hover:bg-white/[0.06]"
          >
            <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-[var(--color-accent-soft)] transition group-hover:border-[var(--color-accent)]/25">
              <DashboardIcon name={action.icon} className="size-4" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">{action.label}</p>
              <p className="text-xs text-white/50">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
