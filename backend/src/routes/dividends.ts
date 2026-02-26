import { Router } from "express";
import { ZodError } from "zod";
import {
  createDividend,
  deleteDividend,
  listDividends,
  updateDividend
} from "../services/portfolioService.js";
import { createDividendSchema, updateDividendSchema } from "../validation/schemas.js";
import { parseId, toValidationMessage } from "../utils/api.js";

const router = Router();

router.get("/dividends", (_req, res) => {
  res.json(listDividends());
});

router.post("/dividends", (req, res) => {
  try {
    const payload = createDividendSchema.parse(req.body) as Parameters<typeof createDividend>[0];
    const created = createDividend({
      ...payload,
      exDividendDate: payload.exDividendDate ?? null
    });
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: toValidationMessage(error) });
      return;
    }
    throw error;
  }
});

router.patch("/dividends/:id", (req, res) => {
  try {
    const id = parseId(req.params.id);
    const payload = updateDividendSchema.parse(req.body);
    const updated = updateDividend(id, payload);
    if (!updated) {
      res.status(404).json({ message: "Dividend record not found." });
      return;
    }
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
    throw error;
  }
});

router.delete("/dividends/:id", (req, res) => {
  try {
    const id = parseId(req.params.id);
    const removed = deleteDividend(id);
    if (!removed) {
      res.status(404).json({ message: "Dividend record not found." });
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

export default router;
