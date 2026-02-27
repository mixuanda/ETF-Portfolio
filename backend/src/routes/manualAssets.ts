import { Router } from "express";
import { ZodError } from "zod";
import {
  createManualAsset,
  deleteManualAsset,
  listManualAssetsWithMetrics,
  updateManualAsset
} from "../services/portfolioService.js";
import { syncFirebaseProgramSafely } from "../services/firebaseSyncHook.js";
import { createManualAssetSchema, updateManualAssetSchema } from "../validation/schemas.js";
import { parseId, toValidationMessage } from "../utils/api.js";

const router = Router();

router.get("/manual-assets", (_req, res) => {
  res.json({ manualAssets: listManualAssetsWithMetrics() });
});

router.post("/manual-assets", async (req, res) => {
  try {
    const payload = createManualAssetSchema.parse(req.body) as Parameters<typeof createManualAsset>[0];
    const created = createManualAsset(payload);
    await syncFirebaseProgramSafely("create manual asset");
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: toValidationMessage(error) });
      return;
    }

    if (
      error instanceof Error &&
      (error.message.includes("UNIQUE") || error.message.includes("constraint failed"))
    ) {
      res.status(409).json({ message: "A manual asset with the same code already exists." });
      return;
    }

    throw error;
  }
});

router.patch("/manual-assets/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const payload = updateManualAssetSchema.parse(req.body);
    const updated = updateManualAsset(id, payload);

    if (!updated) {
      res.status(404).json({ message: "Manual asset not found." });
      return;
    }

    await syncFirebaseProgramSafely("update manual asset");
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

router.delete("/manual-assets/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const removed = deleteManualAsset(id);
    if (!removed) {
      res.status(404).json({ message: "Manual asset not found." });
      return;
    }
    await syncFirebaseProgramSafely("delete manual asset");
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
