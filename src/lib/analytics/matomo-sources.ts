export type MatomoAcquisitionRow = {
  label: string;
  nb_visits: number;
  nb_conversions: number;
};

export type DashboardSourceRow = {
  label: string;
  visits: number;
  conversions: number;
};

function mapReferrerTypeLabel(label: string) {
  const type = label.trim().toLowerCase();

  if (type.includes("campaign")) return "Kampaně – neurčeno";
  if (type.includes("social")) return "Sociální sítě";
  if (type.includes("website")) return "Odkazující weby";
  if (type.includes("search")) return "Vyhledávače";
  if (type.includes("direct")) return "Přímý vstup";
  if (type.includes("ai assistant")) return "AI asistenti";

  return label.trim() || "Ostatní zdroje";
}

/**
 * Matomo Referrers.getCampaigns vrací pouze jméno kampaně, nikoli její source/medium.
 * Jako placenou platformu lze proto označit jen jednoznačný prefix kampaně.
 */
export function mapCampaignLabel(label: string) {
  const name = label.trim().toLowerCase();

  if (/^sklik(?:$|[^a-z0-9])/.test(name)) return "Sklik";
  if (/^(?:google[\s._-]*ads|gads|adwords)(?:$|[^a-z0-9])/.test(name)) return "Google Ads";
  if (/^(?:meta[\s._-]*ads|facebook[\s._-]*ads|instagram[\s._-]*ads|fb[\s._-]*ads|ig[\s._-]*ads)(?:$|[^a-z0-9])/.test(name)) {
    return "Meta Ads";
  }
  if (/^(?:ig|insta|instagram)(?:$|[^a-z0-9])/.test(name)) return "Instagram (označená kampaň)";
  if (/^(?:fb|facebook)(?:$|[^a-z0-9])/.test(name)) return "Facebook (označená kampaň)";
  if (/^(?:firmy|firma)(?:$|[^a-z0-9])/.test(name)) return "Firmy.cz (označená kampaň)";
  if (/^offline(?:$|[^a-z0-9])/.test(name)) return "Offline (označená kampaň)";

  return "Kampaně – neurčeno";
}

function mapSearchEngineLabel(label: string) {
  const name = label.trim() || "Neznámý";
  return `${name} (vyhledávač)`;
}

function mapSocialLabel(label: string) {
  const name = label.trim() || "Neznámá síť";
  return `${name} (sociální síť)`;
}

function aggregateRows(rows: DashboardSourceRow[]) {
  const totals = new Map<string, { visits: number; conversions: number }>();

  for (const row of rows) {
    const current = totals.get(row.label) ?? { visits: 0, conversions: 0 };
    current.visits += row.visits;
    current.conversions += row.conversions;
    totals.set(row.label, current);
  }

  return [...totals.entries()]
    .map(([label, totals]) => ({ label, ...totals }))
    .sort((a, b) => b.visits - a.visits || a.label.localeCompare(b.label, "cs"));
}

/**
 * Návštěvy i konverze se rozpadnou jen v případě, že detailní report
 * souhlasí s nadřazeným součtem. Neúplný rozpad dostane vlastní zbytek.
 * Neshodné konverze při úplném počtu návštěv znamenají návrat k agregátu:
 * nikdy nesmí vzniknout zavádějící nulové konverze jednotlivých zdrojů.
 */
function expandReferrer(
  parent: MatomoAcquisitionRow,
  details: MatomoAcquisitionRow[],
  labelForDetail: (label: string) => string,
): DashboardSourceRow[] {
  const fallbackLabel = mapReferrerTypeLabel(parent.label);
  const fallback = [{ label: fallbackLabel, visits: parent.nb_visits, conversions: parent.nb_conversions }];
  const validDetails = details.filter((row) => row.nb_visits > 0);
  const detailVisits = validDetails.reduce((sum, row) => sum + row.nb_visits, 0);
  const detailConversions = validDetails.reduce((sum, row) => sum + row.nb_conversions, 0);

  if (
    detailVisits === 0 ||
    detailVisits > parent.nb_visits ||
    detailConversions > parent.nb_conversions ||
    (detailVisits === parent.nb_visits && detailConversions !== parent.nb_conversions)
  ) {
    return fallback;
  }

  const result = validDetails.map((row) => ({
    label: labelForDetail(row.label),
    visits: row.nb_visits,
    conversions: row.nb_conversions,
  }));
  const remainingVisits = parent.nb_visits - detailVisits;
  const remainingConversions = parent.nb_conversions - detailConversions;

  if (remainingVisits > 0) {
    result.push({
      label: fallbackLabel,
      visits: remainingVisits,
      conversions: remainingConversions,
    });
  }

  return result;
}

export function buildSourceRows(
  referrers: MatomoAcquisitionRow[],
  campaigns: MatomoAcquisitionRow[],
  searchEngines: MatomoAcquisitionRow[],
  socials: MatomoAcquisitionRow[],
): DashboardSourceRow[] {
  const rows: DashboardSourceRow[] = [];

  for (const referrer of referrers) {
    const type = referrer.label.trim().toLowerCase();

    if (type.includes("campaign")) {
      rows.push(...expandReferrer(referrer, campaigns, mapCampaignLabel));
    } else if (type.includes("search")) {
      rows.push(...expandReferrer(referrer, searchEngines, mapSearchEngineLabel));
    } else if (type.includes("social")) {
      rows.push(...expandReferrer(referrer, socials, mapSocialLabel));
    } else {
      rows.push({
        label: mapReferrerTypeLabel(referrer.label),
        visits: referrer.nb_visits,
        conversions: referrer.nb_conversions,
      });
    }
  }

  const sources = aggregateRows(rows);
  const visibleSources = sources.slice(0, 8);
  const otherSources = sources.slice(8);

  if (otherSources.length === 0) return visibleSources;

  return [
    ...visibleSources,
    {
      label: "Ostatní",
      visits: otherSources.reduce((sum, row) => sum + row.visits, 0),
      conversions: otherSources.reduce((sum, row) => sum + row.conversions, 0),
    },
  ];
}
