import type { QuoteData, QuoteError } from "@portfolio/shared";
import type { QuoteProvider, QuoteProviderResult } from "../QuoteProvider.js";

function normalizeHongKongSymbol(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase();
  if (/^\d{4,5}$/.test(trimmed)) {
    return `${Number(trimmed)}.HK`;
  }
  return trimmed;
}

type YahooQuotePayload = {
  quoteResponse?: {
    result?: Array<{
      symbol?: string;
      regularMarketPrice?: number;
      regularMarketChange?: number;
      regularMarketChangePercent?: number;
      regularMarketTime?: number;
      currency?: string;
    }>;
  };
};

export class YahooQuoteProvider implements QuoteProvider {
  readonly name = "yahoo";

  constructor(private readonly timeoutMs: number) {}

  async fetchQuotes(symbols: string[]): Promise<QuoteProviderResult> {
    if (symbols.length === 0) {
      return { quotes: [], errors: [] };
    }

    const normalizedPairs = symbols.map((symbol) => ({
      original: symbol,
      normalized: normalizeHongKongSymbol(symbol)
    }));

    const mapNormalizedToOriginal = new Map(
      normalizedPairs.map((pair) => [pair.normalized.toUpperCase(), pair.original])
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let payload: YahooQuotePayload;
    try {
      const query = normalizedPairs.map((pair) => pair.normalized).join(",");
      const response = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error(`Yahoo Finance request failed with HTTP ${response.status}`);
      }

      payload = (await response.json()) as YahooQuotePayload;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Yahoo quote request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const results = payload.quoteResponse?.result ?? [];
    const quotes: QuoteData[] = [];
    const errors: QuoteError[] = [];
    const seenSymbols = new Set<string>();

    for (const item of results) {
      const providerSymbol = item.symbol?.toUpperCase();
      if (!providerSymbol) {
        continue;
      }

      const originalSymbol = mapNormalizedToOriginal.get(providerSymbol);
      if (!originalSymbol) {
        continue;
      }

      const price = item.regularMarketPrice;
      if (typeof price !== "number" || !Number.isFinite(price)) {
        errors.push({
          symbol: originalSymbol,
          message: "Price unavailable from Yahoo Finance"
        });
        continue;
      }

      seenSymbols.add(originalSymbol);
      quotes.push({
        symbol: originalSymbol,
        price,
        changeAmount: Number.isFinite(item.regularMarketChange ?? null)
          ? (item.regularMarketChange as number)
          : null,
        changePercent: Number.isFinite(item.regularMarketChangePercent ?? null)
          ? (item.regularMarketChangePercent as number)
          : null,
        currency: item.currency ?? "HKD",
        asOf: item.regularMarketTime
          ? new Date(item.regularMarketTime * 1000).toISOString()
          : new Date().toISOString(),
        provider: this.name
      });
    }

    for (const symbol of symbols) {
      if (!seenSymbols.has(symbol)) {
        const alreadyErrored = errors.some((entry) => entry.symbol === symbol);
        if (!alreadyErrored) {
          errors.push({ symbol, message: "Quote not found in Yahoo Finance response" });
        }
      }
    }

    return { quotes, errors };
  }
}
