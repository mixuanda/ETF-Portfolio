import { Router } from "express";
import { getInstrumentBySymbol, searchInstruments } from "../services/instrumentService.js";

const router = Router();

router.get("/instruments/search", (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) {
    res.json({ results: [] });
    return;
  }

  const results = searchInstruments(query);
  res.json({ results });
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

export default router;
