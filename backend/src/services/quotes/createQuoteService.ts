import type { QuoteProviderName } from "@portfolio/shared";
import { QuoteService } from "./QuoteService.js";
import { DemoQuoteProvider } from "./providers/DemoQuoteProvider.js";
import { YahooQuoteProvider } from "./providers/YahooQuoteProvider.js";

export function createQuoteService(input: {
  provider: QuoteProviderName;
  timeoutMs: number;
  retries: number;
}): QuoteService {
  const safeTimeout = Math.max(1000, Math.min(input.timeoutMs, 20_000));
  const safeRetries = Math.max(0, Math.min(input.retries, 3));

  if (input.provider === "demo") {
    return new QuoteService(new DemoQuoteProvider(), {
      retries: safeRetries
    });
  }

  return new QuoteService(new YahooQuoteProvider(safeTimeout), {
    retries: safeRetries,
    fallbackProvider: new DemoQuoteProvider()
  });
}
