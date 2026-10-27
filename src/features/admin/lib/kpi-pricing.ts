export type KpiBookingPriceFields = {
  finalPriceCzk: number | null | undefined;
  servicePriceFromCzk: number | null | undefined;
};

/** Historická KPI cena nesmí po změně katalogu přepsat uložený cenový snapshot. */
export function getKpiHistoricalPrice({ finalPriceCzk, servicePriceFromCzk }: KpiBookingPriceFields) {
  const value = finalPriceCzk ?? servicePriceFromCzk;
  return value == null ? null : Math.max(0, value);
}
