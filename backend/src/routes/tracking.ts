import { Router } from "express";
import { ZodError } from "zod";
import {
  addToWatchlist,
  createTransaction,
  listTransactions,
  listWatchlistWithQuotes,
  removeWatchlistItem
} from "../services/trackingService.js";
import { parseId, toValidationMessage } from "../utils/api.js";
import { createTransactionSchema, createWatchlistSchema } from "../validation/schemas.js";

const router = Router();

router.get("/watchlist", (_req, res) => {
  res.json({ watchlist: listWatchlistWithQuotes() });
});

router.post("/watchlist", (req, res) => {
  try {
    const payload = createWatchlistSchema.parse(req.body) as Parameters<typeof addToWatchlist>[0];
    const item = addToWatchlist(payload);
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: toValidationMessage(error) });
      return;
    }

    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
      return;
    }

    throw error;
  }
});

router.delete("/watchlist/:id", (req, res) => {
  try {
    const id = parseId(req.params.id);
    const removed = removeWatchlistItem(id);

    if (!removed) {
      res.status(404).json({ message: "Watchlist item not found." });
      return;
    }

    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid id parameter") {
      res.status(400).json({ message: error.message });
      return;
    }
    throw error;
  }
});

router.get("/transactions", (req, res) => {
  const symbol = typeof req.query.symbol === "string" ? req.query.symbol : undefined;
  const transactions = listTransactions({ symbol, limit: 100 });
  res.json({ transactions });
});

router.post("/transactions", (req, res) => {
  try {
    const payload = createTransactionSchema.parse(req.body) as Parameters<typeof createTransaction>[0];
    const created = createTransaction(payload);
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: toValidationMessage(error) });
      return;
    }

    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
      return;
    }

    throw error;
  }
});

export default router;
