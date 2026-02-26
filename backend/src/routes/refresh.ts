import { Router } from "express";
import type { RefreshResponse } from "@portfolio/shared";
import { listTrackedSymbols, saveQuoteSnapshots } from "../services/portfolioService.js";
import { getSettings, setRefreshState } from "../services/settingsService.js";
import { createQuoteService } from "../services/quotes/createQuoteService.js";

const router = Router();

router.post("/refresh", async (_req, res, next) => {
  try {
    setRefreshState({ status: "refreshing", error: null });

    const symbols = listTrackedSymbols();
    if (symbols.length === 0) {
      const refreshedAt = new Date().toISOString();
      setRefreshState({ status: "success", refreshedAt, error: null });

      const response: RefreshResponse = {
        status: "success",
        refreshedAt,
        updatedSymbols: [],
        failedSymbols: [],
        message: "No symbols configured. Add holdings to refresh prices.",
        provider: "n/a"
      };

      res.json(response);
      return;
    }

    const settings = getSettings();
    const quoteService = createQuoteService({
      provider: settings.quoteProvider,
      timeoutMs: settings.refreshTimeoutMs,
      retries: settings.refreshRetries
    });

    const result = await quoteService.fetchQuotes(symbols);
    const refreshedAt = new Date().toISOString();

    if (result.quotes.length > 0) {
      saveQuoteSnapshots(result.quotes, refreshedAt);
    }

    const failedSymbols = result.errors.map((entry) => ({
      symbol: entry.symbol,
      message: entry.message
    }));

    const status = result.quotes.length > 0 ? "success" : "failed";
    const message =
      status === "success"
        ? failedSymbols.length > 0
          ? `Updated ${result.quotes.length} symbol(s). ${failedSymbols.length} symbol(s) failed.`
          : `Updated ${result.quotes.length} symbol(s).`
        : "Unable to refresh quotes. Please try again in a moment.";

    setRefreshState({
      status,
      refreshedAt,
      error: status === "failed" ? message : failedSymbols.length > 0 ? message : null
    });

    const response: RefreshResponse = {
      status,
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
      refreshedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unexpected quote refresh error"
    });
    next(error);
  }
});

export default router;
