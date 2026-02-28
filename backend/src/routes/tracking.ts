import { Router } from "express";
import { ZodError } from "zod";
import {
  addToWatchlist,
  createTransaction,
  deleteTransaction,
  listTransactions,
  listWatchlistWithQuotes,
  removeWatchlistItem,
  updateTransaction
} from "../services/trackingService.js";
import { syncFirebaseProgramSafely } from "../services/firebaseSyncHook.js";
import { parseId, toValidationMessage } from "../utils/api.js";
import {
  createTransactionSchema,
  createWatchlistSchema,
  updateTransactionSchema
} from "../validation/schemas.js";

const router = Router();

router.get("/watchlist", (_req, res) => {
  res.json({ watchlist: listWatchlistWithQuotes() });
});

router.post("/watchlist", async (req, res) => {
  try {
    const payload = createWatchlistSchema.parse(req.body) as Parameters<typeof addToWatchlist>[0];
    const item = addToWatchlist(payload);
    await syncFirebaseProgramSafely("create watchlist item");
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

router.delete("/watchlist/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const removed = removeWatchlistItem(id);

    if (!removed) {
      res.status(404).json({ message: "Watchlist item not found." });
      return;
    }

    await syncFirebaseProgramSafely("delete watchlist item");
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

router.post("/transactions", async (req, res) => {
  try {
    const payload = createTransactionSchema.parse(req.body) as Parameters<typeof createTransaction>[0];
    const created = createTransaction(payload);
    await syncFirebaseProgramSafely("create transaction");
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

router.patch("/transactions/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const payload = updateTransactionSchema.parse(req.body);
    const updated = updateTransaction(id, payload);

    if (!updated) {
      res.status(404).json({ message: "Transaction not found." });
      return;
    }

    await syncFirebaseProgramSafely("update transaction");
    res.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: toValidationMessage(error) });
      return;
    }

    if (error instanceof Error && error.message === "Invalid id parameter") {
      res.status(400).json({ message: error.message });
      return;
    }

    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
      return;
    }

    throw error;
  }
});

router.delete("/transactions/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const removed = deleteTransaction(id);

    if (!removed) {
      res.status(404).json({ message: "Transaction not found." });
      return;
    }

    await syncFirebaseProgramSafely("delete transaction");
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid id parameter") {
      res.status(400).json({ message: error.message });
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
