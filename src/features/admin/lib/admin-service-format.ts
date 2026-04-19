const formatPrice = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

export function formatServicePrice(value: number | null) {
  if (value === null) {
    return "Bez ceny";
  }

  return formatPrice.format(value);
}
