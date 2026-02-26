import { Router } from "express";
import { ZodError } from "zod";
import { listTrackedSymbols } from "../services/portfolioService.js";
import { getSettings, updateSettings } from "../services/settingsService.js";
import { updateSettingsSchema } from "../validation/schemas.js";
import { toValidationMessage } from "../utils/api.js";

const router = Router();

router.get("/settings", (_req, res) => {
  const settings = getSettings();
  const trackedSymbols = listTrackedSymbols();
  res.json({ settings, trackedSymbols });
});

router.patch("/settings", (req, res) => {
  try {
    const payload = updateSettingsSchema.parse(req.body);
    const settings = updateSettings(payload);
    res.json(settings);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ message: toValidationMessage(error) });
      return;
    }
    throw error;
  }
});

export default router;
