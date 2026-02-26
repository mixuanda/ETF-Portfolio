import type { QuoteProviderName } from "@portfolio/shared";
import { QuoteService } from "./QuoteService.js";
import { DemoQuoteProvider } from "./providers/DemoQuoteProvider.js";
import { HkexQuoteProvider } from "./providers/HkexQuoteProvider.js";
import { YahooQuoteProvider } from "./providers/YahooQuoteProvider.js";

export function createQuoteService(input: {
  provider: QuoteProviderName;
  timeoutMs: number;
  retries: number;
  enableHkexBackup: boolean;
  enableDemoMode: boolean;
  allowDemoFallback: boolean;
}): QuoteService {
  const safeTimeout = Math.max(1000, Math.min(input.timeoutMs, 20_000));
  const safeRetries = Math.max(0, Math.min(input.retries, 3));
  const demoEnabled = input.enableDemoMode;
  const allowDemoFallback = demoEnabled && input.allowDemoFallback;
  const backupProviders = [];

  if (input.enableHkexBackup) {
    backupProviders.push(new HkexQuoteProvider(safeTimeout));
  }

  if (allowDemoFallback) {
    backupProviders.push(new DemoQuoteProvider());
  }

  if (input.provider === "demo" && demoEnabled) {
    return new QuoteService(new DemoQuoteProvider(), {
      retries: safeRetries
    });
  }

  return new QuoteService(new YahooQuoteProvider(safeTimeout), {
    retries: safeRetries,
    backupProviders
  });
}
