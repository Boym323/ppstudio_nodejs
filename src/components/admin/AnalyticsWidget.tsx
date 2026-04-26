"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type AnalyticsDashboardData = {
  reportingStatus: "ok" | "disabled" | "blocked" | "error";
  reportingMessage?: string;
  visits: number;
  conversions: number;
  conversionRate: number;
  topSource: string;
  sources: {
    label: string;
    visits: number;
    conversions: number;
  }[];
  funnel: {
    service: number;
    date: number;
    time: number;
    created: number;
  };
};

type AnalyticsWidgetProps = {
  className?: string;
  enabled?: boolean;
};

type AnalyticsWidgetState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: AnalyticsDashboardData };

const numberFormatter = new Intl.NumberFormat("cs-CZ");
const percentFormatter = new Intl.NumberFormat("cs-CZ", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function isAnalyticsDashboardData(value: unknown): value is AnalyticsDashboardData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const funnel = candidate.funnel;

  if (!funnel || typeof funnel !== "object" || Array.isArray(funnel)) {
    return false;
  }

  const funnelCandidate = funnel as Record<string, unknown>;

  return (
    Number.isFinite(candidate.visits) &&
    Number.isFinite(candidate.conversions) &&
    Number.isFinite(candidate.conversionRate) &&
    ["ok", "disabled", "blocked", "error"].includes(String(candidate.reportingStatus)) &&
    (candidate.reportingMessage === undefined || typeof candidate.reportingMessage === "string") &&
    typeof candidate.topSource === "string" &&
    Array.isArray(candidate.sources) &&
    candidate.sources.every(
      (source) =>
        Boolean(source) &&
        typeof source === "object" &&
        !Array.isArray(source) &&
        typeof (source as Record<string, unknown>).label === "string" &&
        Number.isFinite((source as Record<string, unknown>).visits) &&
        Number.isFinite((source as Record<string, unknown>).conversions),
    ) &&
    Number.isFinite(funnelCandidate.service) &&
    Number.isFinite(funnelCandidate.date) &&
    Number.isFinite(funnelCandidate.time) &&
    Number.isFinite(funnelCandidate.created)
  );
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatPercent(value: number) {
  return `${percentFormatter.format(value)} %`;
}

function FunnelStep({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper?: string;
}) {
  return (
    <div className="rounded-[1rem] border border-white/8 bg-black/18 px-4 py-3.5">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/42">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-white">{formatNumber(value)}</p>
      {helper ? <p className="mt-1 text-xs text-white/46">{helper}</p> : null}
    </div>
  );
}

function SourcesList({ sources }: { sources: AnalyticsDashboardData["sources"] }) {
  if (sources.length === 0) {
    return (
      <p className="rounded-[1rem] border border-dashed border-white/12 bg-black/18 px-4 py-4 text-sm text-white/56">
        Zatím nejsou dostupná data o zdrojích.
      </p>
    );
  }

  return (
    <div className="divide-y divide-white/7 overflow-hidden rounded-[1rem] border border-white/8 bg-black/18">
      {sources.map((source) => (
        <div
          key={source.label}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{source.label || "—"}</p>
            <p className="mt-0.5 text-xs text-white/42">
              {formatNumber(source.conversions)} rezervací
            </p>
          </div>
          <p className="text-right text-lg font-semibold tabular-nums text-white">
            {formatNumber(source.visits)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsWidget({
  className,
  enabled = true,
}: AnalyticsWidgetProps) {
  const [state, setState] = useState<AnalyticsWidgetState>({ status: "loading" });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();

    async function loadAnalytics() {
      try {
        const response = await fetch("/api/admin/analytics", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Analytics request failed.");
        }

        const payload: unknown = await response.json();

        if (!isAnalyticsDashboardData(payload)) {
          throw new Error("Analytics payload is invalid.");
        }

        setState({
          status: "ready",
          data: payload,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (process.env.NODE_ENV === "development") {
          console.warn("Analytics widget failed to load.", error);
        }

        setState({ status: "error" });
      }
    }

    void loadAnalytics();

    return () => {
      controller.abort();
    };
  }, [enabled]);

  return (
    <section
      className={cn(
        "rounded-[1.65rem] border border-white/8 bg-zinc-900/88 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--color-accent-soft)]">
            Návštěvnost → rezervace
          </p>
          <p className="mt-2 text-sm leading-6 text-white/56">
            Jak se návštěvy webu mění v rezervace.
          </p>
        </div>
      </div>

      {!enabled ? (
        <div className="mt-6 rounded-[1.15rem] border border-white/10 bg-black/18 px-4 py-5 text-sm text-white/62">
          Matomo není nakonfigurované.
        </div>
      ) : null}

      {enabled && state.status === "loading" ? (
        <div className="mt-6 rounded-[1.15rem] border border-dashed border-white/12 bg-white/[0.03] px-4 py-5 text-sm text-white/62">
          Načítání návštěvnosti…
        </div>
      ) : null}

      {enabled && state.status === "error" ? (
        <div className="mt-6 rounded-[1.15rem] border border-red-300/18 bg-red-500/10 px-4 py-5 text-sm text-red-50">
          Data návštěvnosti nejsou dočasně dostupná.
        </div>
      ) : null}

      {enabled && state.status === "ready" ? (
        state.data.reportingStatus !== "ok" ? (
          <div className="mt-6 rounded-[1.15rem] border border-amber-300/18 bg-amber-400/10 px-4 py-5 text-sm text-amber-50">
            {state.data.reportingMessage || "Matomo reporting není teď dostupný."}
          </div>
        ) : (
        <div className="mt-6 space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)] xl:items-start">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <article className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] px-4 py-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/42">
                    Návštěvy
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-white">
                    {formatNumber(state.data.visits)}
                  </p>
                </article>

                <article className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] px-4 py-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/42">
                    Rezervace
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-white">
                    {formatNumber(state.data.conversions)}
                  </p>
                </article>

                <article className="rounded-[1.1rem] border border-white/8 bg-white/[0.04] px-4 py-4 sm:col-span-2 xl:col-span-1">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-white/42">
                    Konverze %
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-white">
                    {formatPercent(state.data.conversionRate)}
                  </p>
                </article>
              </div>

              <div className="rounded-[1.1rem] border border-white/8 bg-black/18 px-4 py-3.5">
                <p className="text-sm text-white/72">
                  Top zdroj:{" "}
                  <span className="font-medium text-white">
                    {state.data.topSource.trim().length > 0 ? state.data.topSource : "—"}
                  </span>
                </p>
              </div>

              <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/42">
                    Zdroje rezervací
                  </p>
                  <span className="text-xs text-white/42">návštěvy</span>
                </div>
                <SourcesList sources={state.data.sources} />
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-white/42">
                  Funnel
                </p>
                <span className="text-xs text-white/42">
                  Datum: {formatNumber(state.data.funnel.date)}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-2.5">
                <FunnelStep label="Návštěva" value={state.data.visits} />
                <div className="flex justify-center text-lg text-white/26">↓</div>
                <FunnelStep label="Služba" value={state.data.funnel.service} />
                <div className="flex justify-center text-lg text-white/26">↓</div>
                <FunnelStep
                  label="Čas"
                  value={state.data.funnel.time}
                  helper={`Výběr data: ${formatNumber(state.data.funnel.date)}`}
                />
                <div className="flex justify-center text-lg text-white/26">↓</div>
                <FunnelStep label="Rezervace" value={state.data.funnel.created} />
              </div>
            </div>
          </div>
        </div>
        )
      ) : null}
    </section>
  );
}
