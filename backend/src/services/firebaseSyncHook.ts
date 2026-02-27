import { syncPortfolioToFirebaseProgramIfEnabled } from "./firebasePortfolioProgramService.js";

export async function syncFirebaseProgramSafely(context: string): Promise<void> {
  try {
    const result = await syncPortfolioToFirebaseProgramIfEnabled();
    if (result) {
      console.log(
        `[firebase] synced after ${context}: ${result.trackedSymbolCount} symbols, ${result.transactionCount} transactions`
      );
    }
  } catch (error) {
    console.warn(
      `[firebase] sync failed after ${context}: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}
