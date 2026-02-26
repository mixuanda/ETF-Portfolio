import type { QuoteProviderName } from "@portfolio/shared";
import { QuoteService } from "./QuoteService.js";
import { DemoQuoteProvider } from "./providers/DemoQuoteProvider.js";
import { YahooQuoteProvider } from "./providers/YahooQuoteProvider.js";

export function createQuoteService(input: {
  provider: QuoteProviderName;
  timeoutMs: number;
  retries: number;
  enableDemoMode: boolean;
  allowDemoFallback: boolean;
}): QuoteService {
  const safeTimeout = Math.max(1000, Math.min(input.timeoutMs, 20_000));
  const safeRetries = Math.max(0, Math.min(input.retries, 3));
  const demoEnabled = input.enableDemoMode;
  const allowDemoFallback = demoEnabled && input.allowDemoFallback;

  if (input.provider === "demo" && demoEnabled) {
    return new QuoteService(new DemoQuoteProvider(), {
      retries: safeRetries
    });
  }

  return new QuoteService(new YahooQuoteProvider(safeTimeout), {
    retries: safeRetries,
    fallbackProvider: allowDemoFallback ? new DemoQuoteProvider() : undefined
  });
}
