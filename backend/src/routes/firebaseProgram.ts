import { Router } from "express";
import {
  getFirebaseProgramStatus,
  restorePortfolioFromFirebaseProgram,
  syncPortfolioToFirebaseProgram
} from "../services/firebasePortfolioProgramService.js";

const router = Router();

router.get("/firebase/status", (_req, res) => {
  res.json(getFirebaseProgramStatus());
});

router.post("/firebase/sync", async (_req, res) => {
  try {
    const result = await syncPortfolioToFirebaseProgram();
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Firebase sync failed"
    });
  }
});

router.post("/firebase/restore", async (_req, res) => {
  try {
    const result = await restorePortfolioFromFirebaseProgram();
    res.json(result);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Firebase restore failed"
    });
  }
});

export default router;
