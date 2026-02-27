import { config } from "./config.js";
import { initializeDatabase } from "./db/bootstrap.js";
import { restorePortfolioFromFirebaseProgramIfNeeded } from "./services/firebasePortfolioProgramService.js";

initializeDatabase();

try {
  const restoreResult = await restorePortfolioFromFirebaseProgramIfNeeded();
  if (restoreResult.restored) {
    console.log("[firebase] restored portfolio snapshot from cloud on startup");
  } else if (restoreResult.reason) {
    console.log(`[firebase] startup restore skipped: ${restoreResult.reason}`);
  }
} catch (error) {
  console.warn(
    `[firebase] startup restore failed: ${error instanceof Error ? error.message : "unknown error"}`
  );
}

const { default: app } = await import("./app.js");

app.listen(config.port, () => {
  console.log(`Backend API running at http://localhost:${config.port}`);
});
