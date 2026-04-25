import Link from "next/link";

import { cn } from "@/lib/utils";

import { type AdminDashboardData } from "../lib/admin-dashboard";
import { DashboardTodayTimeline } from "./dashboard-today-timeline";

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
        "rounded-[1.65rem] border border-white/7 bg-zinc-900/88 shadow-[0_18px_50px_rgba(0,0,0,0.18)]",
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
        "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
        tone === "primary" &&
          "border border-[var(--color-accent)]/50 bg-[rgba(190,160,120,0.16)] text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] hover:border-[var(--color-accent)]/70 hover:bg-[rgba(190,160,120,0.24)]",
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

export function DashboardPage({ data }: DashboardPageProps) {
  return (
    <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-[1600px] px-0.5 py-0.5 sm:px-1 sm:py-1 lg:px-1">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_336px]">
        <main className="min-w-0 space-y-6">
          <DashboardTodayHero data={data} />
          <DashboardAttentionAlert data={data} />
          <DashboardTodayTimelineSection data={data} />
          <DashboardKpiGrid data={data} />
        </main>

        <RightSidebar data={data} />
      </div>
    </div>
  );
}

export function DashboardTodayHero({ data }: DashboardPageProps) {
  return (
    <Card className="overflow-hidden p-5 sm:p-6 xl:p-8">
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(190,160,120,0.18),transparent_46%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_30%)]" />

        <div className="relative space-y-6">
          <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.85fr)] xl:items-start xl:gap-7">
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-sm font-medium tracking-[0.04em] text-[var(--color-accent-soft)]">
                  Dnešní provoz
                </p>
                <p className="text-lg font-medium text-white/76">{data.todayLabel}</p>
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                  <span className="text-6xl font-bold leading-none text-white sm:text-7xl xl:text-[5rem]">
                    {data.todayBookingsCount}
                  </span>
                  <span className="pb-2 text-sm text-white/52 sm:pb-3 sm:text-base">
                    {data.todayBookingsLabel}
                  </span>
                </div>
                <p className="max-w-2xl text-base text-white/74">{data.todayStatusLabel}</p>
                <p className="max-w-2xl text-sm text-white/54">{data.nextReservationSummary}</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <DashboardButton
                  href={data.timelineFooterHref}
                  label="Otevřít dnešní plán"
                  tone="primary"
                />
                <DashboardButton href={`${data.timelineFooterHref}/novy`} label="Přidat termín" />
                {data.nextClient ? (
                  <DashboardButton
                    href={data.nextClient.detailHref}
                    label="Detail rezervace"
                    tone="outline"
                  />
                ) : null}
              </div>
            </div>

            <div className="rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/42">
                  Další klientka
                </p>
                {data.nextClient ? (
                  <DashboardBadge tone="warning">{data.nextClient.relativeLabel}</DashboardBadge>
                ) : null}
              </div>

              {data.nextClient ? (
                <div className="mt-5 space-y-5">
                  <div className="space-y-2">
                    <p className="text-4xl font-bold tracking-tight text-white">
                      {data.nextClient.timeLabel}
                    </p>
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium text-white/76">
                        {data.nextClient.serviceName}
                      </p>
                      <p className="text-lg font-semibold text-white">
                        {data.nextClient.clientName}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <DashboardButton href={data.nextClient.detailHref} label="Detail" />
                    <DashboardButton href={data.nextClient.editHref} label="Upravit" tone="outline" />
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-2">
                  <p className="text-base font-medium text-white">Dnes je klidnější den.</p>
                  <p className="text-sm leading-6 text-white/56">
                    Jakmile přibude další dnešní rezervace, objeví se tady jako další krok.
                  </p>
                  <div className="pt-1">
                    <DashboardButton href={`${data.timelineFooterHref}/novy`} label="Přidat termín" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DashboardTodayTasks data={data} />
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
  const primaryAlert = data.alerts.find((alert) => alert.emphasis === "primary") ?? null;
  const secondaryAlerts = data.alerts.filter((alert) => alert.emphasis === "secondary");
  const okAlert = data.alerts.find((alert) => alert.emphasis === "ok") ?? null;

  return (
    <div className="space-y-4">
      {primaryAlert ? (
        <Card className="border-amber-300/18 bg-[linear-gradient(135deg,rgba(120,53,15,0.25),rgba(24,24,27,0.92))] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 rounded-xl border border-amber-300/20 bg-black/16 p-2.5 text-amber-100">
                <DashboardIcon name="warning" className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/68">
                  Vyžaduje pozornost
                </p>
                <p className="mt-1 text-lg font-semibold text-amber-50">{primaryAlert.text}</p>
                <p className="mt-1 text-sm text-amber-100/70">
                  Otevři rezervace a zpracuj čekající potvrzení dřív, než půjdeš dál do dnešního rozvrhu.
                </p>
              </div>
            </div>

            <DashboardButton href={primaryAlert.href} label="Otevřít" tone="primary" />
          </div>
        </Card>
      ) : null}

      {secondaryAlerts.length > 0 ? (
        <div className={cn("grid gap-4", secondaryAlerts.length > 1 ? "md:grid-cols-2" : "grid-cols-1")}>
          {secondaryAlerts.map((alert) => (
            <SecondaryAlertCard key={alert.id} tone={alert.tone} text={alert.text} href={alert.href} />
          ))}
        </div>
      ) : null}

      {!primaryAlert && !secondaryAlerts.length && okAlert ? (
        <Card className="border-emerald-300/12 bg-emerald-500/8 p-4">
          <div className="flex items-center gap-3 text-emerald-50">
            <span className="rounded-xl border border-emerald-300/16 bg-black/12 p-2">
              <DashboardIcon name="success" className="size-4" />
            </span>
            <p className="text-sm font-medium">{okAlert.text}</p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function SecondaryAlertCard({
  tone,
  text,
  href,
}: {
  tone: "warning" | "problem" | "success";
  text: string;
  href: string;
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
    <Card key={text} className={cn("p-[1.125rem]", toneStyles[tone])}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 rounded-xl border border-current/15 bg-black/10 p-2.5">
            <DashboardIcon name={toneIcons[tone]} className="size-4" />
          </span>
          <p className="text-[15px] font-medium leading-6">{text}</p>
        </div>

        <Link
          href={href}
          className="inline-flex min-h-10 items-center justify-center self-start rounded-lg border border-current/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-current transition hover:bg-black/10 sm:min-h-0 sm:self-auto"
        >
          Otevřít
        </Link>
      </div>
    </Card>
  );
}

export function DashboardTodayTimelineSection({ data }: DashboardPageProps) {
  return (
    <Card className="overflow-hidden">
      <div className="sticky top-3 z-10 border-b border-white/7 bg-[rgba(24,24,27,0.96)] px-5 py-4 backdrop-blur sm:px-6 xl:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[1.35rem] font-semibold text-white">Dnešní plán</h2>
            <p className="mt-1 text-sm text-white/56">
              Hlavní pracovní plocha pro dnešek. Kliknutím na řádek otevřeš detail nebo úpravu.
            </p>
          </div>
          <DashboardBadge tone="gold">{data.todayLabel}</DashboardBadge>
        </div>
      </div>

      {data.timelineItems.length > 0 ? (
        <DashboardTodayTimeline area={data.area} items={data.timelineItems} />
      ) : (
        <div className="px-5 py-8 sm:px-6 xl:px-7">
          <p className="text-base font-medium text-white">Dnes není naplánovaná žádná rezervace.</p>
          <p className="mt-2 text-sm text-white/58">Přidej termín a připrav si dnešní dostupnost.</p>
          <div className="mt-4">
            <DashboardButton href={`${data.timelineFooterHref}/novy`} label="Přidat termín" />
          </div>
        </div>
      )}

      <div className="border-t border-white/7 px-5 py-4 sm:px-6 xl:px-7">
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

export function DashboardKpiGrid({ data }: DashboardPageProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {data.kpis.map((item) => (
        <article
          key={item.label}
          className="rounded-[1.2rem] border border-white/6 bg-white/[0.03] p-4 shadow-none"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/34">
            {item.label}
          </p>
          <p className="mt-2.5 text-2xl font-semibold text-white/88">{item.value}</p>
          <p className="mt-2 text-xs text-white/46">{item.detail}</p>
        </article>
      ))}
    </div>
  );
}

export function RightSidebar({ data }: DashboardPageProps) {
  return (
    <aside className="space-y-5 xl:sticky xl:top-5">
      <DashboardAvailableSlots data={data} />
      <DashboardQuickActions data={data} />
    </aside>
  );
}

export function DashboardAvailableSlots({ data }: DashboardPageProps) {
  return (
    <Card className="p-5.5">
      <div className="border-b border-white/7 pb-4">
        <h2 className="text-base font-semibold text-white">Nejbližší volné sloty</h2>
        <p className="mt-1 text-sm text-white/52">Kompaktní přehled dnešních a zítřejších oken.</p>
      </div>

      <div className="space-y-3.5 pt-4.5">
        {data.upcomingSlots.length > 0 ? (
          data.upcomingSlots.map((slot, index) => (
            <Link
              key={slot.id}
              href={slot.href}
              className={cn(
                "group flex items-center justify-between gap-4 rounded-[1rem] px-3 py-3 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55",
                index < data.upcomingSlots.length - 1 && "border-b border-white/5",
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold text-white">{slot.timeLabel}</p>
                  <span className="text-xs uppercase tracking-[0.18em] text-white/38">
                    {slot.dayLabel}
                  </span>
                </div>
                <p className="mt-1 text-sm text-white/54">{slot.metaLabel}</p>
              </div>
              <span className="text-xl text-white/32 transition group-hover:text-white/56">→</span>
            </Link>
          ))
        ) : (
          <div>
            <p className="text-sm font-medium text-white">Dnes nejsou volná okna.</p>
            <p className="mt-2 text-sm text-white/58">Uprav dostupnost nebo přidej další termín.</p>
            <div className="mt-4">
              <DashboardButton href={data.upcomingSlotsFooterHref} label="Upravit dostupnost" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/7 pt-4">
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
  const [primaryAction, ...secondaryActions] = data.quickActions;

  return (
    <Card className="p-5.5">
      <div className="border-b border-white/7 pb-4">
        <h2 className="text-base font-semibold text-white">Rychlé akce</h2>
      </div>

      <div className="space-y-3.5 pt-4.5">
        {primaryAction ? (
          <Link
            href={primaryAction.href}
            className="group flex min-h-28 flex-col justify-between rounded-[1.2rem] border border-[var(--color-accent)]/28 bg-[rgba(190,160,120,0.12)] p-[1.125rem] transition hover:border-[var(--color-accent)]/42 hover:bg-[rgba(190,160,120,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55"
          >
            <span className="flex size-11 items-center justify-center rounded-xl border border-[var(--color-accent)]/18 bg-black/18 text-[var(--color-accent-soft)]">
              <DashboardIcon name={primaryAction.icon} className="size-4" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">{primaryAction.label}</p>
              <p className="text-xs leading-5 text-white/68">{primaryAction.description}</p>
            </div>
          </Link>
        ) : null}

        <div className="grid gap-3">
          {secondaryActions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              className="group flex items-center gap-3 rounded-[1rem] border border-white/8 bg-white/[0.035] px-4 py-3 transition hover:border-white/14 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55"
            >
              <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-black/18 text-[var(--color-accent-soft)] transition group-hover:border-[var(--color-accent)]/25">
                <DashboardIcon name={action.icon} className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{action.label}</p>
                <p className="text-xs leading-5 text-white/46">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Card>
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
