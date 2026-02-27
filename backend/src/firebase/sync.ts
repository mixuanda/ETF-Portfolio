import { getFirebaseProgramStatus, syncPortfolioToFirebaseProgram } from "../services/firebasePortfolioProgramService.js";

async function main(): Promise<void> {
  const status = getFirebaseProgramStatus();
  if (!status.enabled) {
    console.log("Firebase program disabled. Set FIREBASE_ENABLED=true to run sync.");
    return;
  }

  const result = await syncPortfolioToFirebaseProgram();
  console.log(
    `Synced portfolio ${result.portfolioId} to Firebase project ${result.projectId}: ${result.trackedSymbolCount} symbol(s), ${result.purchaseCount} purchase(s), ${result.transactionCount} transaction(s).`
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
