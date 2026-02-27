let activeIntlLocale = "en-HK";

export function setFormatLocale(locale: string): void {
  activeIntlLocale = locale;
}

export function formatCurrency(value: number, currency = "HKD"): string {
  return new Intl.NumberFormat(activeIntlLocale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatSignedCurrency(value: number, currency = "HKD"): string {
  const amount = formatCurrency(Math.abs(value), currency);
  if (value === 0) {
    return amount;
  }
  return value > 0 ? `+${amount}` : `-${amount}`;
}

export function formatDateTime(value: string | null, emptyLabel = "Not refreshed yet"): string {
  if (!value) {
    return emptyLabel;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(activeIntlLocale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function numberTone(value: number): "positive" | "negative" | "neutral" {
  if (value > 0) {
    return "positive";
  }
  if (value < 0) {
    return "negative";
  }
  return "neutral";
}
