import { Router } from "express";
import { config } from "../config.js";
import { getInstrumentBySymbol, searchInstruments } from "../services/instrumentService.js";
import { syncTrackedInstrumentMetadata } from "../services/instrumentMetadataSyncService.js";
import { syncFirebaseProgramSafely } from "../services/firebaseSyncHook.js";

const router = Router();

router.get("/instruments/search", async (req, res, next) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) {
    res.json({ results: [] });
    return;
  }

  try {
    const results = await searchInstruments({
      query,
      timeoutMs: config.requestTimeoutMs
    });
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

router.get("/instruments/:symbol", (req, res) => {
  const symbol = String(req.params.symbol ?? "").trim().toUpperCase();
  const instrument = getInstrumentBySymbol(symbol);

  if (!instrument) {
    res.status(404).json({ message: "Instrument not found." });
    return;
  }

  res.json({ instrument });
});

router.post("/instruments/sync", async (_req, res, next) => {
  try {
    const result = await syncTrackedInstrumentMetadata(config.requestTimeoutMs);
    await syncFirebaseProgramSafely("sync instrument metadata");
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
