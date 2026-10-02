import Link from "next/link";

import { AnalyticsWidget } from "@/components/admin/AnalyticsWidget";
import { env } from "@/config/env";

import { BookingTrendChart, ClientMixChart, RevenueTrendChart } from "@/features/admin/components/admin-kpi-charts";
import { AdminPanel, AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { KpiPeriodFilter } from "@/features/admin/components/kpi-period-filter";
import { KpiServicesTable } from "@/features/admin/components/kpi-services-table";
import { interpretKpiComparison } from "@/features/admin/lib/kpi-comparison";
import { kpiComparisonConfig } from "@/features/admin/lib/kpi-config";
import { usesMonthlyKpiBuckets } from "@/features/admin/lib/kpi-date-range";
import { type KpiDashboardData, type KpiMetric } from "@/features/admin/types/kpi-dashboard";

const money = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 });
const number = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("cs-CZ", { style: "percent", maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Prague" });

function metricDetail(metric: KpiMetric, formatter: (value: number) => string, lowerIsBetter = false, percentagePoints = false, neutral = false) {
  const comparison = interpretKpiComparison(metric, { lowerIsBetter, neutral });
  if (comparison.state === "unavailable") return "Srovnání není dostupné";
  if (comparison.direction === "flat") return "Oproti předchozímu období: beze změny";
  const arrow = comparison.direction === "up" ? "↑" : "↓";
  const difference = percentagePoints ? `${metric.difference >= 0 ? "+" : ""}${decimal.format(metric.difference)} p. b.` : `${metric.difference >= 0 ? "+" : ""}${formatter(metric.difference)}`;
  const relativeChange = !percentagePoints && metric.change !== null ? `${metric.change >= 0 ? "+" : ""}${percent.format(metric.change / 100)} · ` : "";
  const evaluation = comparison.isFavorable === null ? "" : comparison.isFavorable ? " · lepší" : " · horší";
  return `Oproti předchozímu období: ${arrow} ${relativeChange}${difference}${evaluation}`;
}
function MetricDefinition({ text, label }: { text: string; label: string }) {
  return <details className="mt-3 text-xs text-white/65">
    <summary className="w-fit cursor-pointer rounded-sm py-1 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]" aria-label={`Jak se počítá: ${label}`}>Jak se počítá</summary>
    <p className="mt-2 leading-5">{text}</p>
  </details>;
}
function KpiCard({ label, metric, format, href, detail, tooltip, kpiKey, valueOverride, showComparison = true }: { label: string; metric: KpiMetric; format: (value: number) => string; href?: string; detail?: string; tooltip?: string; kpiKey?: keyof typeof kpiComparisonConfig; valueOverride?: string; showComparison?: boolean }) {
  const config = kpiKey ? kpiComparisonConfig[kpiKey] : undefined;
  const neutral = Boolean(config && "neutral" in config && config.neutral);
  const comparison = interpretKpiComparison(metric, { lowerIsBetter: config?.lowerIsBetter, neutral });
  const comparisonColor = comparison.isFavorable === true ? "text-emerald-300/85" : comparison.isFavorable === false ? "text-rose-300/85" : "text-white/65";
  return <article data-kpi-card={label} className="min-w-0 rounded-[1.25rem] border border-white/10 bg-white/[0.045] p-4">
    <h4 className="text-xs font-semibold text-white/75">{label}</h4>
    <p className="mt-2 break-words font-display text-2xl text-white sm:text-3xl">{valueOverride ?? format(metric.value)}</p>
    {detail ? <p className="mt-2 text-xs leading-5 text-white/65">{detail}</p> : null}
    {showComparison ? <p className={`mt-2 text-xs leading-5 ${comparisonColor}`}>{metricDetail(metric, format, config?.lowerIsBetter, Boolean(config && "percentagePoints" in config && config.percentagePoints), neutral)}</p> : null}
    {tooltip ? <MetricDefinition text={tooltip} label={label} /> : null}
    {href ? <Link href={href} className="mt-3 inline-block rounded-sm py-1 text-xs font-medium text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">Zobrazit dokončené rezervace →</Link> : null}
  </article>;
}
function CompactKpiCard({ label, value, detail, comparison }: { label: string; value: string; detail: string; comparison?: string }) {
  return <article data-kpi-card={label} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.045] px-3.5 py-3">
    <h4 className="text-xs font-semibold text-white/75">{label}</h4>
    <p className="mt-1 break-words font-display text-xl tabular-nums text-white sm:text-2xl">{value}</p>
    <p className="mt-1 text-xs leading-5 text-white/65">{detail}</p>
    {comparison ? <p className="mt-1 text-xs leading-5 text-white/65">{comparison}</p> : null}
  </article>;
}
function ForecastPairCard({ title, actualLabel, actualValue, actualComparison, forecastLabel, forecastValue, forecastDetail, totalLabel, totalValue, forecastAvailable, tooltip }: { title: string; actualLabel: string; actualValue: string; actualComparison: string; forecastLabel: string; forecastValue: string; forecastDetail?: string; totalLabel: string; totalValue: string; forecastAvailable: boolean; tooltip: string }) {
  return <article data-kpi-card={title} className="flex min-w-0 flex-col rounded-[1.25rem] border border-white/10 bg-white/[0.045] p-4">
    <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-semibold text-white/85">{title}</h4><details className="relative shrink-0 text-xs text-white/65"><summary className="cursor-pointer rounded-sm py-1 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">Definice</summary><p className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-white/10 bg-neutral-950 p-3 leading-5 text-white shadow-xl">{tooltip}</p></details></div>
    <div className="mt-3 grid min-w-0 gap-3 min-[360px]:grid-cols-2">
      <div className="min-w-0 border-b border-white/10 pb-3 min-[360px]:border-b-0 min-[360px]:border-r min-[360px]:pb-0 min-[360px]:pr-3"><p className="text-xs leading-5 text-white/70 min-[360px]:min-h-10 sm:min-h-0">{actualLabel}</p><p className="mt-1 break-words font-display text-xl tabular-nums text-white sm:text-2xl">{actualValue}</p></div>
      <div className="min-w-0"><p className="text-xs leading-5 text-white/70 min-[360px]:min-h-10 sm:min-h-0">{forecastLabel}</p><p className="mt-1 break-words font-display text-xl tabular-nums text-[var(--color-accent-soft)] sm:text-2xl">{forecastAvailable ? forecastValue : "—"}</p></div>
    </div>
    <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-white/10 pt-3 text-xs leading-5 text-white/65"><span>{actualComparison}</span>{forecastAvailable && forecastDetail ? <span className="text-amber-200/85">{forecastDetail}</span> : null}<span className="sm:ml-auto">{forecastAvailable ? <><span>{totalLabel}: </span><span className="font-semibold text-white">{totalValue}</span></> : "Historický výhled není dostupný"}</span></div>
  </article>;
}
export function AdminKpiDashboardPage({ data, area }: { data: KpiDashboardData; area: "owner" | "salon"; searchParams?: Record<string, string | string[] | undefined> }) {
  const path = area === "owner" ? "/admin/statistiky" : "/admin/provoz/statistiky";
  const bookingHref = area === "owner" ? "/admin/rezervace" : "/admin/provoz/rezervace";
  const unavailableComparisons = Object.values(data.metrics).filter((metric) => !metric.previousHasData).length;
  const chartPeriodDescription = usesMonthlyKpiBuckets(data.range)
    ? "Po měsících. První a poslední bod mohou zahrnovat jen vybranou část měsíce."
    : "Po jednotlivých dnech.";
  const expectedRevenueLabel = data.range.period === "this_month"
    ? "Očekáváno do konce měsíce"
    : data.range.period === "this_year"
      ? "Očekáváno do konce roku"
      : "Očekáváno v období";
  const expectedRevenue = data.expectedRevenue;
  const expectedVisitsLabel = data.range.period === "this_month"
    ? "Očekáváno do konce měsíce"
    : data.range.period === "this_year"
      ? "Očekáváno do konce roku"
      : "Očekáváno v období";
  const expectedRevenueAvailable = !expectedRevenue.isHistorical;
  const forecastRevenueTotal = data.metrics.revenue.value + data.metrics.expectedRevenue.value;
  const forecastVisitsTotal = data.metrics.completed.value + expectedRevenue.bookingCount;
  return <AdminPageShell eyebrow="Manažerský přehled" title="KPI a statistiky" description={`Výkon salonu za „${data.range.label}“. Přepočet: ${dateTime.format(data.calculatedAt)}.`} compact denseIntro>
    <AdminPanel title="Období" compact denseHeader>
      <KpiPeriodFilter path={path} activePeriod={data.range.period} rangeLabel={formatRange(data.range.start, data.range.end)} initialFrom={formatInputDate(data.range.start)} initialTo={formatInputDate(new Date(data.range.end.getTime() - 1))} />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/65"><p>Srovnání: {formatRange(data.previousRange.start, data.previousRange.end)}.</p><details className="relative text-xs"><summary className="cursor-pointer rounded-sm py-1 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">Metodika srovnání</summary><p className="absolute z-10 mt-2 w-80 rounded-xl border border-white/10 bg-neutral-950 p-3 leading-5 text-white shadow-xl">Celé měsíce porovnáváme s předchozím kalendářním měsícem; ostatní rozsahy s bezprostředně předcházejícím stejně dlouhým obdobím.</p></details></div>
    </AdminPanel>
    {unavailableComparisons >= Math.ceil(Object.values(data.metrics).length / 2) ? <p className="rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white/68">Porovnání není dostupné, protože pro předchozí období nemáme dostatek historických dat.</p> : null}
    <AdminPanel title="Výsledek a výhled" compact denseHeader>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <ForecastPairCard title="Tržby" actualLabel="Dokončeno" actualValue={money.format(data.metrics.revenue.value)} actualComparison={metricDetail(data.metrics.revenue, money.format)} forecastLabel={expectedRevenueLabel} forecastValue={money.format(data.metrics.expectedRevenue.value)} forecastDetail={expectedRevenue.missingPriceCount ? `${number.format(expectedRevenue.missingPriceCount)} budoucích rezervací bez ceny · odhad tržeb je neúplný` : undefined} totalLabel="Odhad celkem" totalValue={money.format(forecastRevenueTotal)} forecastAvailable={expectedRevenueAvailable} tooltip="Dokončené tržby jsou součet cen dokončených návštěv. Očekávané tržby jsou ceny potvrzených budoucích rezervací; nejde o garantované platby." />
        <ForecastPairCard title="Návštěvy" actualLabel="Dokončeno" actualValue={number.format(data.metrics.completed.value)} actualComparison={metricDetail(data.metrics.completed, number.format)} forecastLabel={expectedVisitsLabel} forecastValue={number.format(expectedRevenue.bookingCount)} totalLabel="Odhad celkem" totalValue={number.format(forecastVisitsTotal)} forecastAvailable={expectedRevenueAvailable} tooltip="Dokončené návštěvy jsou uzavřené návštěvy v období. Očekávané návštěvy jsou potvrzené budoucí rezervace ve stejném výhledu jako očekávané tržby." />
      </div>
    </AdminPanel>
    <AdminPanel title="Výkon a kapacita" compact denseHeader>
      <div className={`grid min-w-0 gap-2.5 ${data.monthlyOccupancy ? "sm:grid-cols-2 xl:grid-cols-3 sm:[&>article:last-child]:col-span-2 xl:[&>article:last-child]:col-span-1" : "sm:grid-cols-2"}`}>
        <CompactKpiCard label="Průměrná útrata" value={data.metrics.completed.value ? money.format(data.metrics.averageSpend.value) : "—"} detail={data.metrics.completed.value ? metricDetail(data.metrics.averageSpend, money.format) : "Bez dokončených návštěv"} />
        <CompactKpiCard label="Obsazenost · využití kapacity" value={data.occupancy.bookableMinutes ? percent.format(data.metrics.occupancy.value / 100) : "—"} detail={data.occupancy.bookableMinutes ? `${decimal.format(data.occupancy.reservedMinutes / 60)} h využito z ${decimal.format(data.occupancy.bookableMinutes / 60)} h dostupných${data.metrics.occupancy.value > 100 ? " · Využití přesahuje evidovanou kapacitu." : ""}` : "Není evidovaná dostupná kapacita"} comparison={data.occupancy.bookableMinutes ? metricDetail(data.metrics.occupancy, percent.format, false, true, true) : undefined} />
        {data.monthlyOccupancy ? <CompactKpiCard label="Zaplnění celého měsíce" value={data.monthlyOccupancy.bookableMinutes ? percent.format(data.monthlyOccupancy.percent / 100) : "—"} detail={data.monthlyOccupancy.bookableMinutes ? `${decimal.format(data.monthlyOccupancy.reservedMinutes / 60)} h rezervováno z ${decimal.format(data.monthlyOccupancy.bookableMinutes / 60)} h dostupných` : "Není evidovaná dostupná kapacita"} /> : null}
      </div>
      <MetricDefinition label="Výkon a kapacita" text="Průměrná útrata je součet tržeb dělený počtem dokončených návštěv. Obsazenost počítá dokončené návštěvy včetně blokace po službě vůči zveřejněné kapacitě po odečtení obědů. Zaplnění celého měsíce zahrnuje potvrzené, dokončené a no-show rezervace za celý měsíc." />
    </AdminPanel>
    <section className="grid gap-4 xl:grid-cols-2"><AdminPanel title="Vývoj tržeb" description={chartPeriodDescription} compact denseHeader><RevenueTrendChart rows={data.revenueSeries} hasData={data.metrics.completed.value > 0} /></AdminPanel><AdminPanel title="Vývoj rezervací" description={`Dokončené, zrušené a nedostavení se. ${chartPeriodDescription}`} compact denseHeader><BookingTrendChart rows={data.bookingSeries} /></AdminPanel></section>
    <AdminPanel title="Klientky a opakované návštěvy" description="Rozlišujeme návrat klientky z dřívějšího období a více návštěv uvnitř zvoleného období." compact denseHeader>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Nové klientky" metric={data.metrics.newClients} format={number.format} kpiKey="newClients" tooltip="Klientky, jejichž vůbec první dokončená návštěva nastala ve vybraném období." />
        <KpiCard label="Vracející se klientky" metric={data.metrics.returningClients} format={number.format} kpiKey="returningClients" tooltip="Klientky s dokončenou návštěvou v období a alespoň jednou dokončenou návštěvou před jeho začátkem." />
        <KpiCard label="Klientky s více návštěvami v období" metric={data.metrics.repeatVisitClients} format={number.format} kpiKey="repeatVisitClients" tooltip="Klientky s nejméně dvěma dokončenými návštěvami uvnitř vybraného období." />
        <KpiCard label="Podíl klientek s více návštěvami" metric={data.metrics.repeatVisitRate} format={(v) => percent.format(v / 100)} kpiKey="repeatVisitRate" valueOverride={data.clientMix.newClients + data.clientMix.returningClients ? undefined : "—"} showComparison={data.clientMix.newClients + data.clientMix.returningClients > 0} detail="Silně závisí na délce období; neměří dlouhodobou retenci." tooltip="Podíl klientek s nejméně dvěma dokončenými návštěvami na všech klientkách s dokončenou návštěvou v období." />
      </div>
    </AdminPanel>
    <AdminPanel title="Storna a nedostavení se" description="Míry počítáme z rezervací v historicky zveřejněných termínech podle plánovaného data návštěvy." compact denseHeader>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <KpiCard label="Míra storen" metric={data.metrics.cancellationRate} format={(v) => percent.format(v / 100)} kpiKey="cancellationRate" valueOverride={data.disruptionBookingCount ? undefined : "—"} showComparison={data.disruptionBookingCount > 0} detail={`${number.format(data.metrics.cancellations.value)} storen z ${number.format(data.disruptionBookingCount)} rezervací · Hodnota storen ${money.format(data.metrics.cancellationValue.value)}`} tooltip="Podíl zrušených rezervací v historicky zveřejněných termínech. Nižší míra je příznivější. Hodnota storen je součet jejich cen, nikoliv prokázaná ztráta tržeb." />
        <KpiCard label="Míra nedostavení se (no-show)" metric={data.metrics.noShowRate} format={(v) => percent.format(v / 100)} kpiKey="noShowRate" valueOverride={data.disruptionBookingCount ? undefined : "—"} showComparison={data.disruptionBookingCount > 0} detail={`${number.format(data.metrics.noShows.value)} no-show z ${number.format(data.disruptionBookingCount)} rezervací · Hodnota ${money.format(data.metrics.noShowValue.value)}`} tooltip="Podíl rezervací v historicky zveřejněných termínech, na které klientka nedorazila. Nižší míra je příznivější." />
      </div>
    </AdminPanel>
    <AdminPanel title="Platby" description="Zbývající částky u dokončených návštěv." compact denseHeader>
      <KpiCard label="Neuhrazená částka" metric={data.metrics.outstanding} format={money.format} kpiKey="outstanding" href={`${bookingHref}?status=completed`} detail="U dokončených návštěv v období. Odkaz otevře všechny dokončené rezervace." tooltip="Zbývající částka po neanulovaných platbách a čerpání voucherů u dokončených návštěv." />
    </AdminPanel>
    <section className="grid min-w-0 gap-4 xl:grid-cols-2"><AdminPanel title="Nejvýdělečnější služby" description="Cena a skutečně rezervovaný čas dokončených návštěv." className="min-w-0" compact denseHeader><KpiServicesTable services={data.services} /></AdminPanel><AdminPanel title="Nové vs. vracející se klientky" description={`Vracející se klientka měla alespoň jednu dokončenou návštěvu už před vybraným obdobím. Stav k ${new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeZone: "Europe/Prague" }).format(data.retentionReference)}.`} className="min-w-0" compact denseHeader><ClientMixChart newClients={data.clientMix.newClients} returningClients={data.clientMix.returningClients} /><div className="mt-5"><h3 className="text-sm font-semibold text-white">Klientky podle doby od poslední návštěvy</h3><p className="mt-1 text-xs text-white/60">Kliknutím otevřete odpovídající seznam klientek.</p><div className="mt-3 space-y-2">{data.retention.map((item) => <Link key={item.band} href={item.href} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-3 text-sm hover:border-[var(--color-accent)]/40"><span>{item.label}</span><span className="font-display text-xl">{number.format(item.count)}</span></Link>)}</div></div></AdminPanel></section>
    <TablePanel title="Odkud přicházejí rezervace" description="Souhrn podle zdroje a plánovaného data návštěvy. Objednaná hodnota zahrnuje všechny rezervace, tržby pouze dokončené návštěvy." headers={["Zdroj", "Rezervace", "Dokončeno", "Objednaná hodnota", "Tržby z dokončených", "Průměr na rezervaci"]} empty="Pro vybrané období nejsou dostupná data o zdrojích rezervací." rows={data.acquisition.summary.map((row) => [row.source, number.format(row.bookings), number.format(row.completed), money.format(row.bookingValue), money.format(row.revenue), money.format(row.averageValue)])} />
    <details className="min-w-0 rounded-[var(--radius-panel)] border border-white/10 bg-black/10 p-4">
      <summary className="cursor-pointer rounded-sm text-sm font-medium text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">Podrobnosti zdrojů a kampaní</summary>
      <div className="mt-4">
        <TablePanel title="Podrobnosti zdrojů a kampaní" description="Podrobnější rozpad podle zdroje, typu návštěvnosti a kampaně; rezervace jsou zařazené podle plánovaného data návštěvy." headers={["Zdroj", "Typ návštěvnosti", "Kampaň", "Rezervace", "Dokončeno", "Objednaná hodnota", "Tržby z dokončených", "Průměr na rezervaci"]} empty="Pro vybrané období nejsou dostupná data o zdrojích rezervací." rows={data.acquisition.detail.map((row) => [row.source, row.medium, row.campaign, number.format(row.bookings), number.format(row.completed), money.format(row.bookingValue), money.format(row.revenue), money.format(row.averageValue)])} />
      </div>
    </details>
    <AnalyticsWidget enabled={Boolean(env.MATOMO_URL && env.MATOMO_SITE_ID && env.MATOMO_AUTH_TOKEN)} />
  </AdminPageShell>;
}
function formatInputDate(value: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
function formatRange(start: Date, end: Date) { const formatter = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Prague" }); return `${formatter.format(start)}–${formatter.format(new Date(end.getTime() - 1))}`; }
function TablePanel({ title, description, headers, rows, empty }: { title: string; description?: string; headers: string[]; rows: string[][]; empty: string }) { return <AdminPanel title={title} description={description} compact denseHeader><div className="-mx-1 overflow-x-auto px-1 pb-1" tabIndex={0} aria-label={`${title}, tabulku lze posouvat vodorovně`}><table className="mt-4 min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wider text-white/50"><tr>{headers.map((header) => <th key={header} scope="col" className="whitespace-nowrap px-3 py-2">{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-t border-white/8 text-white/78">{row.map((cell, cellIndex) => cellIndex === 0 ? <th key={cellIndex} scope="row" className="whitespace-nowrap px-3 py-3 font-medium text-white">{cell}</th> : <td key={cellIndex} className="whitespace-nowrap px-3 py-3">{cell}</td>)}</tr>) : <tr><td colSpan={headers.length} className="px-3 py-10 text-white/60">{empty}</td></tr>}</tbody></table></div></AdminPanel>; }
export function AdminKpiDashboardSkeleton() { return <div className="space-y-4 animate-pulse"><div className="h-32 rounded-[var(--radius-panel)] bg-white/8" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 rounded-[1.25rem] bg-white/6" />)}</div></div>; }
