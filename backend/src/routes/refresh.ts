import { Router } from "express";
import type { RefreshResponse } from "@portfolio/shared";
import { config } from "../config.js";
import { listTrackedSymbols, saveQuoteSnapshots } from "../services/portfolioService.js";
import { getSettings, setRefreshState } from "../services/settingsService.js";
import { createQuoteService } from "../services/quotes/createQuoteService.js";

const router = Router();

router.post("/refresh", async (_req, res, next) => {
  try {
    const previousSettings = getSettings();
    setRefreshState({ status: "refreshing", error: null });

    const symbols = listTrackedSymbols();
    if (symbols.length === 0) {
      const message =
        "No symbols configured. Add holdings first. Existing cached data was preserved.";
      setRefreshState({ status: "failed", error: message });

      const response: RefreshResponse = {
        status: "failed",
        refreshedAt: previousSettings.lastRefreshAt,
        updatedSymbols: [],
        failedSymbols: [],
        message,
        provider: previousSettings.lastRefreshProvider ?? "n/a"
      };

      res.json(response);
      return;
    }

    const settings = getSettings();
    const quoteService = createQuoteService({
      provider: settings.quoteProvider,
      timeoutMs: settings.refreshTimeoutMs,
      retries: settings.refreshRetries,
      enableDemoMode: config.enableDemoMode,
      allowDemoFallback: config.allowDemoFallback
    });

    const result = await quoteService.fetchQuotes(symbols);

    const failedSymbols = result.errors.map((entry) => ({
      symbol: entry.symbol,
      message: entry.message
    }));

    if (result.quotes.length === 0) {
      const fallbackMessage =
        failedSymbols.length > 0
          ? failedSymbols[0]?.message ?? "No quotes returned."
          : "No quotes returned.";
      const message = `Quote refresh failed. Showing previous cached data. ${fallbackMessage}`;

      setRefreshState({
        status: "failed",
        error: message
      });

      const response: RefreshResponse = {
        status: "failed",
        refreshedAt: previousSettings.lastRefreshAt,
        updatedSymbols: [],
        failedSymbols,
        message,
        provider: previousSettings.lastRefreshProvider ?? result.provider
      };

      res.json(response);
      return;
    }

    const refreshedAt = new Date().toISOString();
    saveQuoteSnapshots(result.quotes, refreshedAt);
    const usesDemoData = result.provider.toLowerCase().includes("demo");

    const message =
      failedSymbols.length > 0
        ? `Updated ${result.quotes.length} symbol(s). ${failedSymbols.length} symbol(s) failed. Cached prices were kept for failed symbols.`
        : usesDemoData
          ? `Updated ${result.quotes.length} symbol(s) using demo quote data (${result.provider}).`
          : `Updated ${result.quotes.length} symbol(s) from delayed market quotes.`;

    setRefreshState({
      status: "success",
      refreshedAt,
      provider: result.provider,
      error: failedSymbols.length > 0 ? message : null
    });

    const response: RefreshResponse = {
      status: "success",
      refreshedAt,
      updatedSymbols: result.quotes.map((quote) => quote.symbol),
      failedSymbols,
      message,
      provider: result.provider
    };

    res.json(response);
  } catch (error) {
    setRefreshState({
      status: "failed",
      error: error instanceof Error ? error.message : "Unexpected quote refresh error"
    });
    next(error);
  }
});

export default router;
