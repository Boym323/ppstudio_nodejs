import assert from "node:assert/strict";
import { before, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { getKpiDateRanges } from "../lib/kpi-date-range";
import { kpiComparisonConfig } from "../lib/kpi-config";
import type { KpiDashboardData, KpiMetric } from "../types/kpi-dashboard";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "http://127.0.0.1:3100";
process.env.NEXT_PUBLIC_SITE_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/ppstudio_test";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-with-enough-length-123456";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "owner-password";
process.env.ADMIN_STAFF_EMAIL ??= "salon@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "salon-password";

let AdminKpiDashboardPage: typeof import("./admin-kpi-dashboard-page")["AdminKpiDashboardPage"];
before(async () => {
  ({ AdminKpiDashboardPage } = await import("./admin-kpi-dashboard-page"));
});

function metric(value: number, previousValue = 0): KpiMetric {
  return { value, previousValue, previousHasData: true, difference: value - previousValue, change: previousValue ? (value - previousValue) / previousValue * 100 : null };
}

function dashboard(): KpiDashboardData {
  const now = new Date("2026-10-02T10:00:00Z");
  const { current, previous } = getKpiDateRanges({ period: "this_month" }, now);
  return {
    range: current, previousRange: previous, calculatedAt: now,
    metrics: Object.fromEntries(Object.keys(kpiComparisonConfig).map((key) => [key, metric(0)])) as KpiDashboardData["metrics"],
    occupancy: { reservedMinutes: 0, bookableMinutes: 0 },
    monthlyOccupancy: null,
    disruptionBookingCount: 0,
    revenueSeries: [], bookingSeries: [], services: [],
    clientMix: { newClients: 0, returningClients: 0 },
    retention: [], retentionReference: now,
    acquisition: { summary: [], detail: [] },
    expectedRevenue: { bookingCount: 0, missingPriceCount: 0, isHistorical: false },
    unavailable: { hasData: false },
  };
}

function card(html: string, label: string) {
  const result = html.match(new RegExp(`<article[^>]*data-kpi-card="${label}"[^>]*>[\\s\\S]*?</article>`));
  assert.ok(result, `Chybí karta ${label}`);
  return result[0];
}

test("chybějící jmenovatel nezobrazuje nulovou obsazenost, útratu ani míru storen", () => {
  const html = renderToStaticMarkup(<AdminKpiDashboardPage data={dashboard()} area="owner" />);
  for (const label of ["Obsazenost · využití kapacity", "Průměrná útrata", "Míra storen"]) {
    const content = card(html, label);
    assert.match(content, />—</);
    assert.doesNotMatch(content, /Oproti předchozímu období/);
  }
  assert.match(html, /Srovnání: 29\. 9\. 2026–30\. 9\. 2026/);
});

test("obsazenost ukazuje hodiny a desetinné procentní body bez hodnocení lepší či horší", () => {
  const data = dashboard();
  data.occupancy = { reservedMinutes: 302.4, bookableMinutes: 600 };
  data.monthlyOccupancy = { reservedMinutes: 420, bookableMinutes: 600, percent: 70 };
  data.metrics.occupancy = metric(50.4, 50);
  const html = renderToStaticMarkup(<AdminKpiDashboardPage data={data} area="salon" />);
  const content = card(html, "Obsazenost · využití kapacity");
  assert.match(content, /5 h využito z 10 h dostupných/);
  assert.match(content, /\+0,4 p\. b\./);
  assert.doesNotMatch(content, /lepší|horší/);
  assert.match(card(html, "Zaplnění celého měsíce"), /7 h rezervováno z 10 h dostupných/);
  assert.match(html, /href="\/admin\/provoz\/rezervace\?status=completed"/);
});

test("přesah kapacity je viditelný a storna se hodnotí podle míry i při růstu počtu", () => {
  const data = dashboard();
  data.occupancy = { reservedMinutes: 300, bookableMinutes: 240 };
  data.metrics.occupancy = metric(125, 100);
  data.disruptionBookingCount = 40;
  data.metrics.cancellations = metric(4, 3);
  data.metrics.cancellationRate = metric(10, 15);
  const html = renderToStaticMarkup(<AdminKpiDashboardPage data={data} area="owner" />);
  assert.match(card(html, "Obsazenost · využití kapacity"), /125.*Využití přesahuje evidovanou kapacitu/);
  const cancellations = card(html, "Míra storen");
  assert.match(cancellations, /4 storen z 40 rezervací/);
  assert.match(cancellations, /-5 p\. b\. · lepší/);
});

test("výsledek a výhled spojí tržby i návštěvy do stejného období", () => {
  const data = dashboard();
  data.metrics.revenue = metric(1000);
  data.metrics.completed = metric(2);
  data.expectedRevenue = { bookingCount: 4, missingPriceCount: 0, isHistorical: false };
  data.metrics.expectedRevenue = metric(2200);
  const html = renderToStaticMarkup(<AdminKpiDashboardPage data={data} area="owner" />);
  assert.match(card(html, "Tržby"), /Dokončeno.*1\s*000\s*Kč/);
  assert.match(card(html, "Tržby"), /Očekáváno do konce měsíce.*2\s*200\s*Kč/);
  assert.match(card(html, "Tržby"), /Odhad celkem.*3\s*200\s*Kč/);
  assert.match(card(html, "Návštěvy"), /Dokončeno.*2/);
  assert.match(card(html, "Návštěvy"), /Očekáváno do konce měsíce.*4/);
  assert.match(card(html, "Návštěvy"), /Odhad celkem.*6/);
  assert.match(card(html, "Tržby"), /Oproti předchozímu období/);
  assert.match(card(html, "Návštěvy"), /Oproti předchozímu období/);
});

test("neúplný odhad tržeb ukáže chybějící ceny a historický výhled nevydává za nulu", () => {
  const data = dashboard();
  data.expectedRevenue = { bookingCount: 4, missingPriceCount: 2, isHistorical: false };
  let html = renderToStaticMarkup(<AdminKpiDashboardPage data={data} area="owner" />);
  assert.match(card(html, "Tržby"), /2 budoucích rezervací bez ceny · odhad tržeb je neúplný/);
  data.expectedRevenue.isHistorical = true;
  html = renderToStaticMarkup(<AdminKpiDashboardPage data={data} area="owner" />);
  for (const label of ["Tržby", "Návštěvy"]) {
    const content = card(html, label);
    assert.match(content, />—</);
    assert.match(content, /Historický výhled není dostupný/);
    assert.doesNotMatch(content, /Odhad celkem|odhad tržeb je neúplný/);
  }
});
