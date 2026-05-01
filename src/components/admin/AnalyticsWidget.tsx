"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type AnalyticsDashboardData = {
  reportingStatus: "ok" | "disabled" | "blocked" | "error";
  reportingMessage?: string;
  periodLabel: string;
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
    typeof candidate.periodLabel === "string" &&
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
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/18 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-white/50">{label}</p>
        <p className="text-sm font-semibold tracking-tight text-white">{formatNumber(value)}</p>
      </div>
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
    <div className="divide-y divide-white/7 overflow-hidden rounded-lg border border-white/8 bg-black/18">
      {sources.map((source) => (
        <div
          key={source.label}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{source.label || "—"}</p>
            <p className="mt-0.5 text-xs text-white/42">
              odhad {formatNumber(source.conversions)} rezervací
            </p>
          </div>
          <p className="text-right text-sm font-semibold tabular-nums text-white">
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
        "rounded-[1.05rem] border border-white/8 bg-zinc-900/88 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.16)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--color-accent-soft)]">
            Výkon webu
          </p>
          <p className="mt-1 text-sm leading-5 text-white/56">
            Orientační výkon webu a rezervačního flow.
          </p>
        </div>
      </div>

      {!enabled ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/18 px-3 py-3 text-sm text-white/62">
          Matomo není nakonfigurované.
        </div>
      ) : null}

      {enabled && state.status === "loading" ? (
        <div className="mt-3 rounded-lg border border-dashed border-white/12 bg-white/[0.03] px-3 py-3 text-sm text-white/62">
          Načítání návštěvnosti…
        </div>
      ) : null}

      {enabled && state.status === "error" ? (
        <div className="mt-3 rounded-lg border border-red-300/18 bg-red-500/10 px-3 py-3 text-sm text-red-50">
          Data návštěvnosti nejsou dočasně dostupná.
        </div>
      ) : null}

      {enabled && state.status === "ready" ? (
        state.data.reportingStatus !== "ok" ? (
          <div className="mt-3 rounded-lg border border-amber-300/18 bg-amber-400/10 px-3 py-3 text-sm text-amber-50">
            {state.data.reportingMessage || "Matomo reporting není teď dostupný."}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <AnalyticsMetric label="návštěv" value={formatNumber(state.data.visits)} />
              <AnalyticsMetric label="rezervace" value={formatNumber(state.data.conversions)} />
              <AnalyticsMetric label="míra" value={formatPercent(state.data.conversionRate)} />
            </div>

            <details className="group rounded-lg border border-white/8 bg-black/16 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-[var(--color-accent-soft)] outline-none transition group-open:text-white">
                Zobrazit analytiku
              </summary>
              <div className="mt-3 space-y-3">
                <p className="text-sm text-white/72">
                  Nejsilnější zdroj návštěv:{" "}
                  <span className="font-medium text-white">
                    {state.data.topSource.trim().length > 0 ? state.data.topSource : "—"}
                  </span>
                </p>

                <SourcesList sources={state.data.sources} />

                <div className="grid gap-2">
                  <FunnelStep label="Služba" value={state.data.funnel.service} />
                  <FunnelStep label="Datum" value={state.data.funnel.date} />
                  <FunnelStep label="Čas" value={state.data.funnel.time} />
                  <FunnelStep label="Rezervace" value={state.data.funnel.created} />
                </div>
              </div>
            </details>
          </div>
        )
      ) : null}
    </section>
  );
}

function AnalyticsMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-white/8 bg-white/[0.04] px-3 py-2">
      <p className="truncate text-lg font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-0.5 truncate text-[11px] font-medium text-white/44">{label}</p>
    </article>
  );
}
