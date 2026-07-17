export type AcquisitionAggregationInput = {
  acquisitionSource: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  isCompleted: boolean;
  bookingValue: number;
};

export type AcquisitionMetric = {
  bookings: number;
  completed: number;
  bookingValue: number;
  revenue: number;
  averageValue: number;
};

export type AcquisitionDetail = AcquisitionMetric & {
  source: string;
  medium: string;
  campaign: string;
};

export type AcquisitionSummary = AcquisitionMetric & {
  source: string;
};

function clean(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

function aliasKey(value: string) {
  return clean(value).toLocaleLowerCase("cs-CZ").replace(/[._\s-]+/g, "_");
}

function readableUnknown(value: string) {
  return clean(value) || "Neznámý zdroj";
}

/** Normalizace je pouze analytická; uložené hodnoty rezervace nijak nemění. */
export function normalizeAcquisitionSource(
  value: string | null | undefined,
  options: { isDirect?: boolean } = {},
) {
  const raw = clean(value);
  const key = aliasKey(raw);

  if (["ig", "instagram"].includes(key)) return "Instagram";
  if (["fb", "facebook"].includes(key)) return "Facebook";
  if (key === "google") return "Google";
  if (["firmy", "firmy_cz"].includes(key)) return "Firmy.cz";
  if (["sklik", "seznam"].includes(key)) return "Sklik";
  if (["direct", "primy_vstup", "prímý_vstup"].includes(key)) return "Přímý vstup";
  if (!raw) return options.isDirect ? "Přímý vstup" : "Neznámý zdroj";

  return readableUnknown(raw);
}

export function normalizeAcquisitionMedium(value: string | null | undefined) {
  const raw = clean(value);
  if (!raw) return "Neuvedeno";

  const key = aliasKey(raw);
  if (["cpc", "ppc"].includes(key)) return "CPC";
  if (["social", "social_media"].includes(key)) return "Social";
  if (["email", "e_mail"].includes(key)) return "E-mail";
  if (["organic", "organic_search"].includes(key)) return "Organic";
  return readableUnknown(raw);
}

export function normalizeAcquisitionCampaign(value: string | null | undefined) {
  return clean(value) || "—";
}

function emptyMetric(): AcquisitionMetric {
  return { bookings: 0, completed: 0, bookingValue: 0, revenue: 0, averageValue: 0 };
}

function addMetric(metric: AcquisitionMetric, row: AcquisitionAggregationInput) {
  metric.bookings += 1;
  metric.bookingValue += row.bookingValue;
  if (row.isCompleted) {
    metric.completed += 1;
    metric.revenue += row.bookingValue;
  }
}

function finalizeMetric<T extends AcquisitionMetric>(metric: T): T {
  return { ...metric, averageValue: metric.bookings ? metric.bookingValue / metric.bookings : 0 };
}

export function aggregateAcquisition(rows: AcquisitionAggregationInput[]) {
  const details = new Map<string, AcquisitionDetail>();
  const summaries = new Map<string, AcquisitionSummary>();

  for (const row of rows) {
    const source = normalizeAcquisitionSource(clean(row.utmSource) ? row.utmSource : row.acquisitionSource, {
      isDirect: row.acquisitionSource === "DIRECT",
    });
    const medium = normalizeAcquisitionMedium(row.utmMedium);
    const campaign = normalizeAcquisitionCampaign(row.utmCampaign);
    const detailKey = `${source}\u0000${medium}\u0000${campaign}`;
    const detail = details.get(detailKey) ?? { source, medium, campaign, ...emptyMetric() };
    const summary = summaries.get(source) ?? { source, ...emptyMetric() };
    addMetric(detail, row);
    addMetric(summary, row);
    details.set(detailKey, detail);
    summaries.set(source, summary);
  }

  return {
    summary: [...summaries.values()].map(finalizeMetric).sort((left, right) => right.revenue - left.revenue || right.bookings - left.bookings || left.source.localeCompare(right.source, "cs-CZ")),
    detail: [...details.values()].map(finalizeMetric).sort((left, right) => right.revenue - left.revenue || right.bookings - left.bookings || left.source.localeCompare(right.source, "cs-CZ")),
  };
}
