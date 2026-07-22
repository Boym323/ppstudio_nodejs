"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

type RevenueRow = { periodStart: string; label: string; revenue: number };
type BookingRow = { periodStart: string; label: string; completed: number; cancelled: number; noShow: number };

const money = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });

const CHART_COLORS = {
  accent: "var(--color-accent)",
  completed: "#34d399",
  cancelled: "#fbbf24",
  noShow: "#fb7185",
  grid: "rgba(255, 255, 255, 0.09)",
  axis: "rgba(255, 255, 255, 0.48)",
} as const;

const bookingLabels = {
  completed: "Dokončené",
  cancelled: "Storna",
  noShow: "No-show",
} as const;

function compactMoney(value: number) {
  if (Math.abs(value) >= 1_000) return `${number.format(Math.round(value / 1_000))} tis.`;
  return number.format(value);
}

function ChartTooltip({ active, label, payload, valueFormatter = number.format }: TooltipContentProps & { valueFormatter?: (value: number) => string }) {
  if (!active || !payload?.length) return null;

  return <div className="max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-neutral-950/95 px-3 py-2.5 text-xs text-white shadow-xl backdrop-blur">
    {label ? <p className="mb-2 font-medium text-white/70">{label}</p> : null}
    <div className="space-y-1.5">
      {payload.map((entry, index) => {
        const name = typeof entry.name === "string" ? entry.name : String(entry.name ?? "Hodnota");
        const value = Number(entry.value ?? 0);
        return <p key={`${name}-${index}`} className="flex items-center justify-between gap-5"><span className="flex items-center gap-2 text-white/75"><span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />{name}</span><span className="font-medium text-white">{valueFormatter(value)}</span></p>;
      })}
    </div>
  </div>;
}

function EmptyChart() {
  return <div className="flex h-[260px] items-center justify-center text-center text-sm text-white/60">Ve vybraném období nejsou žádná data.</div>;
}

export function RevenueTrendChart({ rows }: { rows: RevenueRow[] }) {
  if (!rows.length) return <EmptyChart />;

  return <div className="pt-4">
    <div className="h-[232px] w-full" role="img" aria-label={`Graf vývoje tržeb s ${rows.length} chronologickými body.`}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
        <defs><linearGradient id="revenue-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.35} /><stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0.02} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
        <XAxis dataKey="label" minTickGap={28} tickLine={false} axisLine={false} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} width={52} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} />
        <Tooltip content={(props) => <ChartTooltip {...props} valueFormatter={money.format} />} cursor={{ stroke: "rgba(255, 255, 255, 0.2)", strokeWidth: 1 }} />
        <Area type="monotone" dataKey="revenue" name="Tržby" stroke={CHART_COLORS.accent} strokeWidth={2.5} fill="url(#revenue-gradient)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
    </div>
    <p className="mt-2 flex items-center gap-2 text-xs text-white/72" aria-label="Legenda grafu: Tržby"><span className="size-2 rounded-full" style={{ backgroundColor: CHART_COLORS.accent }} />Tržby</p>
  </div>;
}

export function BookingTrendChart({ rows }: { rows: BookingRow[] }) {
  if (!rows.length) return <EmptyChart />;

  return <div className="h-[260px] w-full pt-4" role="img" aria-label={`Graf vývoje rezervací s ${rows.length} chronologickými body. Řady: dokončené, storna a no-show.`}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
        <XAxis dataKey="label" minTickGap={28} tickLine={false} axisLine={false} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} domain={[0, "auto"]} tickLine={false} axisLine={false} width={30} tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} />
        <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ stroke: "rgba(255, 255, 255, 0.2)", strokeWidth: 1 }} />
        <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ color: "rgba(255, 255, 255, 0.72)", fontSize: "12px", paddingTop: "12px" }} />
        <Line type="monotone" dataKey="completed" name={bookingLabels.completed} stroke={CHART_COLORS.completed} strokeWidth={2.25} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Line type="monotone" dataKey="cancelled" name={bookingLabels.cancelled} stroke={CHART_COLORS.cancelled} strokeWidth={2.25} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Line type="monotone" dataKey="noShow" name={bookingLabels.noShow} stroke={CHART_COLORS.noShow} strokeWidth={2.25} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

export function ClientMixChart({ newClients, returningClients }: { newClients: number; returningClients: number }) {
  const total = newClients + returningClients;
  if (!total) return <div className="flex h-[260px] items-center justify-center text-center text-sm text-white/60">Ve vybraném období nejsou dokončené návštěvy klientek.</div>;

  const rows = [
    { name: "Nové klientky", value: newClients, color: CHART_COLORS.accent },
    { name: "Vracející se klientky", value: returningClients, color: CHART_COLORS.completed },
  ];
  return <div className="grid items-center gap-2 pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.8fr)]">
    <div className="relative h-[220px]" role="img" aria-label={`Poměr klientek: ${number.format(newClients)} nových a ${number.format(returningClients)} vracejících se, celkem ${number.format(total)}.`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart accessibilityLayer>
          <Tooltip content={(props) => <ChartTooltip {...props} />} />
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="84%" paddingAngle={3} stroke="none">
            {rows.map((row) => <Cell key={row.name} fill={row.color} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-3xl text-white">{number.format(total)}</span><span className="text-xs text-white/60">klientek</span></div>
    </div>
    <div className="space-y-3" aria-label="Textová legenda poměru klientek">
      {rows.map((row) => <div key={row.name} className="rounded-xl border border-white/10 px-3 py-2.5 text-sm"><p className="flex items-center gap-2 text-white/75"><span className="size-2.5 rounded-full" style={{ backgroundColor: row.color }} />{row.name}</p><p className="mt-1 font-medium text-white">{number.format(row.value)} <span className="text-white/55">· {new Intl.NumberFormat("cs-CZ", { style: "percent", maximumFractionDigits: 1 }).format(row.value / total)}</span></p></div>)}
    </div>
  </div>;
}
