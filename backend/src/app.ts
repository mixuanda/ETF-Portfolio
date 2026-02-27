import cors from "cors";
import express from "express";
import { config } from "./config.js";
import dividendsRoutes from "./routes/dividends.js";
import firebaseProgramRoutes from "./routes/firebaseProgram.js";
import holdingsRoutes from "./routes/holdings.js";
import instrumentsRoutes from "./routes/instruments.js";
import manualAssetsRoutes from "./routes/manualAssets.js";
import portfolioRoutes from "./routes/portfolio.js";
import refreshRoutes from "./routes/refresh.js";
import settingsRoutes from "./routes/settings.js";
import trackingRoutes from "./routes/tracking.js";

const app = express();

app.use(
  cors({
    origin: config.frontendOrigin
  })
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", portfolioRoutes);
app.use("/api", holdingsRoutes);
app.use("/api", instrumentsRoutes);
app.use("/api", firebaseProgramRoutes);
app.use("/api", manualAssetsRoutes);
app.use("/api", dividendsRoutes);
app.use("/api", trackingRoutes);
app.use("/api", refreshRoutes);
app.use("/api", settingsRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Unexpected server error";
  console.error(err);
  res.status(500).json({ message });
});

export default app;
