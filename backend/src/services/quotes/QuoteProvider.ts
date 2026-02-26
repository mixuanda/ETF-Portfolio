import type { QuoteData, QuoteError } from "@portfolio/shared";

export interface QuoteProviderResult {
  quotes: QuoteData[];
  errors: QuoteError[];
}

export interface QuoteProvider {
  readonly name: string;
  fetchQuotes(symbols: string[]): Promise<QuoteProviderResult>;
}
