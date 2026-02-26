import { Router } from "express";
import { getPortfolioSnapshot } from "../services/portfolioService.js";

const router = Router();

router.get("/portfolio", (_req, res) => {
  const data = getPortfolioSnapshot();
  res.json(data);
});

export default router;
