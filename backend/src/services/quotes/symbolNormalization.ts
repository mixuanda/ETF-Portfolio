const YAHOO_SYMBOL_OVERRIDES: Record<string, string> = {
  // Legacy-to-current symbol mapping overrides.
  "02006": "3417.HK",
  "02006.HK": "3417.HK",
  "2006": "3417.HK",
  "2006.HK": "3417.HK"
};

const HKEX_SYMBOL_OVERRIDES: Record<string, string> = {
  // Legacy-to-current symbol mapping overrides.
  "02006": "3417",
  "02006.HK": "3417",
  "2006": "3417",
  "2006.HK": "3417"
};

function normalizeDigits(value: string): string {
  const stripped = value.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : "0";
}

export function normalizeForYahoo(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (!upper) {
    return upper;
  }

  const override = YAHOO_SYMBOL_OVERRIDES[upper];
  if (override) {
    return override;
  }

  if (/^\d{1,5}(\.HK)?$/.test(upper)) {
    const digits = upper.endsWith(".HK") ? upper.slice(0, -3) : upper;
    return `${normalizeDigits(digits)}.HK`;
  }

  return upper;
}

export function normalizeForHkex(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  if (!upper) {
    return upper;
  }

  const override = HKEX_SYMBOL_OVERRIDES[upper];
  if (override) {
    return override;
  }

  if (/^\d{1,5}(\.HK)?$/.test(upper)) {
    const digits = upper.endsWith(".HK") ? upper.slice(0, -3) : upper;
    return normalizeDigits(digits);
  }

  return upper.replace(/\.HK$/, "");
}
