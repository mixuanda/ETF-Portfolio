import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { config } from "../config.js";
import db from "../db/client.js";

export interface FirebaseProgramStatus {
  enabled: boolean;
  configured: boolean;
  projectId: string | null;
  portfolioId: string;
  restoreOnBoot: boolean;
}

export interface FirebaseProgramSyncResult {
  syncedAt: string;
  projectId: string;
  portfolioId: string;
  trackedSymbolCount: number;
  purchaseCount: number;
  transactionCount: number;
}

export interface FirebaseProgramRestoreResult {
  restored: boolean;
  restoredAt: string | null;
  reason?: string;
}

type PortfolioProgramSnapshot = {
  version: number;
  instruments: Array<Record<string, unknown>>;
  holdings: Array<Record<string, unknown>>;
  watchlist: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  manualAssets: Array<Record<string, unknown>>;
  assetSnapshots: Array<Record<string, unknown>>;
  dividends: Array<Record<string, unknown>>;
  settings: Array<Record<string, unknown>>;
};

const SNAPSHOT_VERSION = 1;

function decodePrivateKey(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.replace(/\\n/g, "\n");
}

function isConfigured(): boolean {
  return Boolean(
    config.firebaseProjectId && config.firebaseClientEmail && decodePrivateKey(config.firebasePrivateKey)
  );
}

function isFirebaseUsable(): boolean {
  return config.firebaseEnabled && isConfigured();
}

function getFirebaseApp() {
  if (!config.firebaseEnabled) {
    throw new Error("Firebase program is disabled. Set FIREBASE_ENABLED=true to use cloud sync.");
  }

  const projectId = config.firebaseProjectId;
  const clientEmail = config.firebaseClientEmail;
  const privateKey = decodePrivateKey(config.firebasePrivateKey);

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase credentials are incomplete. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

export function getFirebaseProgramStatus(): FirebaseProgramStatus {
  return {
    enabled: config.firebaseEnabled,
    configured: isConfigured(),
    projectId: config.firebaseProjectId,
    portfolioId: config.firebasePortfolioId,
    restoreOnBoot: config.firebaseRestoreOnBoot
  };
}

function getTableRows(query: string): Array<Record<string, unknown>> {
  return db.prepare(query).all() as Array<Record<string, unknown>>;
}

function buildSnapshot(): PortfolioProgramSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    instruments: getTableRows("SELECT * FROM instruments ORDER BY symbol ASC"),
    holdings: getTableRows("SELECT * FROM holdings ORDER BY symbol ASC"),
    watchlist: getTableRows("SELECT * FROM watchlist ORDER BY symbol ASC"),
    transactions: getTableRows("SELECT * FROM transactions ORDER BY trade_date ASC, id ASC"),
    manualAssets: getTableRows("SELECT * FROM manual_assets ORDER BY code ASC"),
    assetSnapshots: getTableRows(
      "SELECT * FROM asset_snapshots ORDER BY fetched_at ASC, id ASC LIMIT 10000"
    ),
    dividends: getTableRows("SELECT * FROM dividends ORDER BY payment_date ASC, id ASC"),
    settings: getTableRows("SELECT * FROM settings ORDER BY key ASC")
  };
}

function hasLocalPortfolioData(): boolean {
  const tables = ["holdings", "watchlist", "transactions", "manual_assets", "dividends"];
  return tables.some((table) => {
    const row = db.prepare(`SELECT COUNT(1) AS count FROM ${table}`).get() as { count: number };
    return row.count > 0;
  });
}

function applySnapshot(snapshot: PortfolioProgramSnapshot): void {
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM watchlist").run();
    db.prepare("DELETE FROM transactions").run();
    db.prepare("DELETE FROM holdings").run();
    db.prepare("DELETE FROM manual_assets").run();
    db.prepare("DELETE FROM asset_snapshots").run();
    db.prepare("DELETE FROM dividends").run();
    db.prepare("DELETE FROM settings").run();

    const upsertInstrument = db.prepare(
      `
        INSERT INTO instruments (
          symbol,
          name_en,
          name_zh,
          asset_type,
          issuer,
          currency,
          region,
          search_keywords,
          is_active,
          created_at,
          updated_at
        ) VALUES (
          @symbol,
          @name_en,
          @name_zh,
          @asset_type,
          @issuer,
          @currency,
          @region,
          @search_keywords,
          @is_active,
          @created_at,
          @updated_at
        )
        ON CONFLICT(symbol)
        DO UPDATE SET
          name_en = excluded.name_en,
          name_zh = excluded.name_zh,
          asset_type = excluded.asset_type,
          issuer = excluded.issuer,
          currency = excluded.currency,
          region = excluded.region,
          search_keywords = excluded.search_keywords,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
      `
    );

    const insertHolding = db.prepare(
      `
        INSERT INTO holdings (
          id,
          symbol,
          name,
          asset_type,
          quantity,
          average_cost,
          currency,
          region,
          strategy_label,
          risk_group,
          tags,
          notes,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @symbol,
          @name,
          @asset_type,
          @quantity,
          @average_cost,
          @currency,
          @region,
          @strategy_label,
          @risk_group,
          @tags,
          @notes,
          @created_at,
          @updated_at
        )
      `
    );

    const insertWatchlist = db.prepare(
      `
        INSERT INTO watchlist (
          id,
          symbol,
          notes,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @symbol,
          @notes,
          @created_at,
          @updated_at
        )
      `
    );

    const insertTransaction = db.prepare(
      `
        INSERT INTO transactions (
          id,
          symbol,
          transaction_type,
          quantity,
          price,
          fee,
          trade_date,
          notes,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @symbol,
          @transaction_type,
          @quantity,
          @price,
          @fee,
          @trade_date,
          @notes,
          @created_at,
          @updated_at
        )
      `
    );

    const insertManualAsset = db.prepare(
      `
        INSERT INTO manual_assets (
          id,
          code,
          name,
          asset_type,
          quantity,
          average_cost,
          currency,
          manual_price,
          region,
          strategy_label,
          risk_group,
          tags,
          notes,
          price_updated_at,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @code,
          @name,
          @asset_type,
          @quantity,
          @average_cost,
          @currency,
          @manual_price,
          @region,
          @strategy_label,
          @risk_group,
          @tags,
          @notes,
          @price_updated_at,
          @created_at,
          @updated_at
        )
      `
    );

    const insertSnapshot = db.prepare(
      `
        INSERT INTO asset_snapshots (
          id,
          symbol,
          price,
          change_amount,
          change_percent,
          currency,
          provider,
          as_of,
          status,
          fetched_at
        ) VALUES (
          @id,
          @symbol,
          @price,
          @change_amount,
          @change_percent,
          @currency,
          @provider,
          @as_of,
          @status,
          @fetched_at
        )
      `
    );

    const insertDividend = db.prepare(
      `
        INSERT INTO dividends (
          id,
          symbol,
          ex_dividend_date,
          payment_date,
          dividend_per_unit,
          received_amount,
          currency,
          notes,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @symbol,
          @ex_dividend_date,
          @payment_date,
          @dividend_per_unit,
          @received_amount,
          @currency,
          @notes,
          @created_at,
          @updated_at
        )
      `
    );

    const upsertSetting = db.prepare(
      `
        INSERT INTO settings (key, value, updated_at)
        VALUES (@key, @value, @updated_at)
        ON CONFLICT(key)
        DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `
    );

    for (const row of snapshot.instruments) {
      upsertInstrument.run(row);
    }
    for (const row of snapshot.holdings) {
      insertHolding.run(row);
    }
    for (const row of snapshot.watchlist) {
      insertWatchlist.run(row);
    }
    for (const row of snapshot.transactions) {
      insertTransaction.run(row);
    }
    for (const row of snapshot.manualAssets) {
      insertManualAsset.run(row);
    }
    for (const row of snapshot.assetSnapshots) {
      insertSnapshot.run(row);
    }
    for (const row of snapshot.dividends) {
      insertDividend.run(row);
    }
    for (const row of snapshot.settings) {
      upsertSetting.run(row);
    }
  });

  tx();
}

export async function syncPortfolioToFirebaseProgram(): Promise<FirebaseProgramSyncResult> {
  const app = getFirebaseApp();
  const firestore = getFirestore(app);

  const snapshot = buildSnapshot();
  const trackedSymbols = [
    ...new Set(
      [...snapshot.holdings, ...snapshot.watchlist]
        .map((item) => String(item.symbol ?? "").trim().toUpperCase())
        .filter((item) => item.length > 0)
    )
  ];
  const transactions = snapshot.transactions.map((item) => ({
    ...item,
    transactionType: item.transaction_type
  })) as Array<Record<string, unknown>>;
  const purchases = transactions.filter((item) => item.transactionType === "BUY");

  const syncedAt = new Date().toISOString();
  const portfolioId = config.firebasePortfolioId;
  const projectId = config.firebaseProjectId as string;

  const docRef = firestore.collection("portfolio_program").doc(portfolioId);

  await docRef.set(
    {
      portfolioId,
      syncedAt,
      trackedSymbols,
      trackedSymbolCount: trackedSymbols.length,
      purchaseItems: purchases,
      purchaseCount: purchases.length,
      transactions,
      transactionCount: transactions.length,
      snapshot,
      source: "etf-portfolio-backend"
    },
    { merge: true }
  );

  return {
    syncedAt,
    projectId,
    portfolioId,
    trackedSymbolCount: trackedSymbols.length,
    purchaseCount: purchases.length,
    transactionCount: transactions.length
  };
}

export async function syncPortfolioToFirebaseProgramIfEnabled(): Promise<FirebaseProgramSyncResult | null> {
  if (!isFirebaseUsable()) {
    return null;
  }

  return syncPortfolioToFirebaseProgram();
}

export async function restorePortfolioFromFirebaseProgram(): Promise<FirebaseProgramRestoreResult> {
  const app = getFirebaseApp();
  const firestore = getFirestore(app);
  const portfolioId = config.firebasePortfolioId;
  const docRef = firestore.collection("portfolio_program").doc(portfolioId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return {
      restored: false,
      restoredAt: null,
      reason: "No cloud snapshot document found"
    };
  }

  const data = doc.data() as { snapshot?: PortfolioProgramSnapshot };
  if (!data?.snapshot) {
    return {
      restored: false,
      restoredAt: null,
      reason: "Cloud snapshot document has no snapshot payload"
    };
  }

  applySnapshot(data.snapshot);
  return {
    restored: true,
    restoredAt: new Date().toISOString()
  };
}

export async function restorePortfolioFromFirebaseProgramIfNeeded(): Promise<FirebaseProgramRestoreResult> {
  if (!isFirebaseUsable()) {
    return {
      restored: false,
      restoredAt: null,
      reason: "Firebase program disabled or credentials missing"
    };
  }

  if (!config.firebaseRestoreOnBoot) {
    return {
      restored: false,
      restoredAt: null,
      reason: "Restore on boot disabled by config"
    };
  }

  if (hasLocalPortfolioData()) {
    return {
      restored: false,
      restoredAt: null,
      reason: "Local database already has data"
    };
  }

  return restorePortfolioFromFirebaseProgram();
}
