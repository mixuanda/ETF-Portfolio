import type { QuoteData, QuoteError } from "@portfolio/shared";
import type { QuoteProvider } from "./QuoteProvider.js";

export interface QuoteFetchResult {
  quotes: QuoteData[];
  errors: QuoteError[];
  provider: string;
}

export class QuoteService {
  constructor(
    private readonly primaryProvider: QuoteProvider,
    private readonly options: {
      retries: number;
      backupProviders?: QuoteProvider[];
    }
  ) {}

  async fetchQuotes(symbols: string[]): Promise<QuoteFetchResult> {
    const uniqueSymbols = [...new Set(symbols.map((item) => item.trim()).filter((item) => item.length > 0))];
    const quoteBySymbol = new Map<string, QuoteData>();
    const errorBySymbol = new Map<string, string>();
    let remaining = [...uniqueSymbols];
    let hadTransportFailure = false;
    let transportFailureMessage: string | null = null;

    for (let attempt = 0; attempt <= this.options.retries; attempt += 1) {
      if (remaining.length === 0) {
        break;
      }

      try {
        const result = await this.primaryProvider.fetchQuotes(remaining);

        for (const quote of result.quotes) {
          quoteBySymbol.set(quote.symbol, quote);
          errorBySymbol.delete(quote.symbol);
        }

        for (const entry of result.errors) {
          errorBySymbol.set(entry.symbol, entry.message);
        }

        remaining = remaining.filter((symbol) => !quoteBySymbol.has(symbol));
      } catch (error) {
        hadTransportFailure = true;
        transportFailureMessage =
          error instanceof Error ? error.message : "Primary quote provider failed unexpectedly";
      }
    }

    const backups = this.options.backupProviders ?? [];
    for (const backup of backups) {
      if (remaining.length === 0) {
        break;
      }

      try {
        const backupResult = await backup.fetchQuotes(remaining);

        for (const quote of backupResult.quotes) {
          quoteBySymbol.set(quote.symbol, quote);
          errorBySymbol.delete(quote.symbol);
        }

        for (const entry of backupResult.errors) {
          if (!quoteBySymbol.has(entry.symbol)) {
            errorBySymbol.set(entry.symbol, entry.message);
          }
        }

        remaining = remaining.filter((symbol) => !quoteBySymbol.has(symbol));
      } catch (error) {
        const backupErrorMessage =
          error instanceof Error ? error.message : `${backup.name} quote provider failed unexpectedly`;
        for (const symbol of remaining) {
          errorBySymbol.set(symbol, backupErrorMessage);
        }
      }
    }

    if (hadTransportFailure && quoteBySymbol.size === 0 && transportFailureMessage) {
      for (const symbol of uniqueSymbols) {
        if (!errorBySymbol.has(symbol)) {
          errorBySymbol.set(symbol, transportFailureMessage);
        }
      }
    }

    for (const symbol of remaining) {
      if (!errorBySymbol.has(symbol)) {
        errorBySymbol.set(symbol, "No quote available for symbol");
      }
    }

    const usedProviders = [...new Set([...quoteBySymbol.values()].map((quote) => quote.provider))];
    const providerLabel = usedProviders.length > 0 ? usedProviders.join(" + ") : this.primaryProvider.name;

    const errors: QuoteError[] = [...errorBySymbol.entries()].map(([symbol, message]) => ({
      symbol,
      message
    }));

    return {
      quotes: [...quoteBySymbol.values()],
      errors,
      provider: providerLabel
    };
  }
}
