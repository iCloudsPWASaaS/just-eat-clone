/** Format a number as a UK-pound amount, e.g. 12.5 -> "£12.50". */
export function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number.isFinite(value) ? value : 0);
}

/** Compact form for dense tables: 1234.5 -> "£1,234.50". */
export function moneyPrecise(value: number): string {
  return money(value);
}
