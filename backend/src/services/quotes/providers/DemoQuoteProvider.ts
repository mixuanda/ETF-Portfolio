import type { QuoteData } from "@portfolio/shared";
import type { QuoteProvider, QuoteProviderResult } from "../QuoteProvider.js";

const REFERENCE_PRICES: Record<string, number> = {
  "03010": 14.2,
  "03153": 51.6,
  "03195": 44.0,
  "03421": 71.0,
  "03450": 10.1,
  "03466": 26.5
};

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value >>> 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function basePriceForSymbol(symbol: string): number {
  if (REFERENCE_PRICES[symbol]) {
    return REFERENCE_PRICES[symbol];
  }

  const seed = hash(symbol);
  return 8 + (seed % 5000) / 100;
}

export class DemoQuoteProvider implements QuoteProvider {
  readonly name = "demo";

  async fetchQuotes(symbols: string[]): Promise<QuoteProviderResult> {
    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const quotes: QuoteData[] = symbols.map((symbol) => {
      const base = basePriceForSymbol(symbol);
      const driftSeed = hash(`${symbol}-${hourBucket}`);
      const driftRatio = ((driftSeed % 201) - 100) / 10_000;
      const price = round(base * (1 + driftRatio));
      const changeAmount = round(price - base);
      const changePercent = base === 0 ? 0 : round((changeAmount / base) * 100);

      return {
        symbol,
        price,
        changeAmount,
        changePercent,
        currency: "HKD",
        asOf: new Date().toISOString(),
        provider: this.name
      };
    });

    return {
      quotes,
      errors: []
    };
  }
}
