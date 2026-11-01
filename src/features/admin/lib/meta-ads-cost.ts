/**
 * Výpočet CPA z útraty reklamního účtu a serverových rezervací.
 * Počítáme pouze prokazatelně placené Facebook/Instagram návštěvy.
 */
export type PaidMetaBookingGroup = {
  acquisitionSource: string | null;
  acquisitionUtmMedium: string | null;
  status: string;
  count: number;
};

export function isPaidMetaMedium(value: string | null | undefined) {
  const medium = (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ["paid_social", "paid", "cpc", "ppc", "paid_social_media"].includes(medium);
}

export function countPaidMetaBookings(groups: PaidMetaBookingGroup[]) {
  let bookings = 0;
  let completed = 0;

  for (const row of groups) {
    if (!["FACEBOOK", "INSTAGRAM"].includes(row.acquisitionSource ?? "") || !isPaidMetaMedium(row.acquisitionUtmMedium)) {
      continue;
    }
    if (!Number.isSafeInteger(row.count) || row.count < 0) {
      continue;
    }
    if (["PENDING", "CONFIRMED", "COMPLETED"].includes(row.status)) {
      bookings += row.count;
      if (row.status === "COMPLETED") completed += row.count;
    }
  }
  return { bookings, completed };
}

export type MetaAdsSpend = { spend: number; currency: string | null; hasData: boolean };

/** Parsování pouze agregovaných Insights, nikoli raw payloadu ani reklamních identifikátorů. */
export function parseMetaAdsSpend(payload: unknown): MetaAdsSpend | null {
  if (!payload || typeof payload !== "object" || !("data" in payload)) return null;
  const rows = (payload as { data: unknown }).data;
  if (!Array.isArray(rows)) return null;
  if (rows.length === 0) return { spend: 0, currency: null, hasData: false };

  let cents = 0;
  let currency: string | null = null;
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    const value = typeof record.spend === "string" || typeof record.spend === "number"
      ? Number(record.spend)
      : NaN;
    const rowCurrency = record.account_currency;
    if (!Number.isFinite(value) || value < 0 || typeof rowCurrency !== "string" || !/^[A-Z]{3}$/.test(rowCurrency)) {
      return null;
    }
    if (currency && currency !== rowCurrency) return null;
    currency = rowCurrency;
    cents += Math.round(value * 100);
  }
  return { spend: cents / 100, currency, hasData: true };
}

export function costPerBooking(spend: number, count: number) {
  return Number.isFinite(spend) && spend >= 0 && Number.isSafeInteger(count) && count > 0
    ? Math.round((spend / count) * 100) / 100
    : null;
}
