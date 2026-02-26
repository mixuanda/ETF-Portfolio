import { Router } from "express";
import { ZodError } from "zod";
import {
  createHolding,
  deleteHolding,
  listHoldings,
  updateHolding
} from "../services/portfolioService.js";
import { createHoldingSchema, updateHoldingSchema } from "../validation/schemas.js";
import { parseId, toValidationMessage } from "../utils/api.js";

const router = Router();

router.get("/holdings", (_req, res) => {
  res.json(listHoldings());
});

router.post("/holdings", (req, res) => {
  try {
    const payload = createHoldingSchema.parse(req.body) as Parameters<typeof createHolding>[0];
    const holding = createHolding(payload);
    res.status(201).json(holding);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: toValidationMessage(error) });
      return;
    }

    if (
      error instanceof Error &&
      (error.message.includes("UNIQUE") || error.message.includes("constraint failed"))
    ) {
      res.status(409).json({ message: "A holding with the same symbol already exists." });
      return;
    }

    throw error;
  }
});

router.patch("/holdings/:id", (req, res) => {
  try {
    const id = parseId(req.params.id);
    const payload = updateHoldingSchema.parse(req.body);
    const updated = updateHolding(id, payload);

    if (!updated) {
      res.status(404).json({ message: "Holding not found." });
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

    if (
      error instanceof Error &&
      (error.message.includes("UNIQUE") || error.message.includes("constraint failed"))
    ) {
      res.status(409).json({ message: "A holding with the same symbol already exists." });
      return;
    }

    throw error;
  }
});

router.delete("/holdings/:id", (req, res) => {
  try {
    const id = parseId(req.params.id);
    const removed = deleteHolding(id);
    if (!removed) {
      res.status(404).json({ message: "Holding not found." });
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
