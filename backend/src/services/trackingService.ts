import type { TransactionRecord, TransactionType, WatchlistItem } from "@portfolio/shared";
import db from "../db/client.js";
import { stringifyTags } from "../utils/parsers.js";
import { getInstrumentBySymbol } from "./instrumentService.js";

type SnapshotRow = {
  symbol: string;
  price: number;
  change_amount: number | null;
  change_percent: number | null;
  provider: string;
  as_of: string;
  fetched_at: string;
};

type WatchlistRow = {
  id: number;
  symbol: string;
  notes: string;
  created_at: string;
  updated_at: string;
  name_en: string;
  name_zh: string;
  asset_type: string;
  issuer: string;
  currency: string;
  region: string;
};

type HoldingSummaryRow = {
  id: number;
  symbol: string;
  quantity: number;
  average_cost: number;
};

type TransactionRow = {
  id: number;
  symbol: string;
  transaction_type: TransactionType;
  quantity: number;
  price: number;
  fee: number;
  trade_date: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapTransaction(row: TransactionRow): TransactionRecord {
  return {
    id: row.id,
    symbol: row.symbol,
    transactionType: row.transaction_type,
    quantity: row.quantity,
    price: row.price,
    fee: row.fee,
    tradeDate: row.trade_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getLatestSnapshots(symbols: string[]): Map<string, SnapshotRow> {
  if (symbols.length === 0) {
    return new Map();
  }

  const placeholders = symbols.map(() => "?").join(",");
  const rows = db
    .prepare(
      `
        SELECT s.symbol,
               s.price,
               s.change_amount,
               s.change_percent,
               s.provider,
               s.as_of,
               s.fetched_at
        FROM asset_snapshots s
        INNER JOIN (
          SELECT symbol, MAX(fetched_at) AS latest_fetched_at
          FROM asset_snapshots
          WHERE symbol IN (${placeholders})
          GROUP BY symbol
        ) latest
        ON latest.symbol = s.symbol
        AND latest.latest_fetched_at = s.fetched_at
      `
    )
    .all(...symbols) as SnapshotRow[];

  return new Map(rows.map((row) => [row.symbol, row]));
}

function inferRiskGroup(assetType: string): string {
  const normalized = assetType.toLowerCase();
  if (normalized.includes("bond") || normalized.includes("money market")) {
    return "defensive";
  }
  return "growth";
}

function inferStrategyLabel(assetType: string): string {
  const normalized = assetType.toLowerCase();
  if (normalized.includes("bond")) {
    return "income";
  }
  if (normalized.includes("money market")) {
    return "cash";
  }
  return "core";
}

function inferTags(assetType: string): string[] {
  const normalized = assetType.toLowerCase();
  if (normalized.includes("bond")) {
    return ["bond"];
  }
  if (normalized.includes("money market")) {
    return ["money market", "defensive"];
  }
  return ["equity"];
}

function getHoldingBySymbol(symbol: string): HoldingSummaryRow | null {
  const row = db
    .prepare(
      `
        SELECT id, symbol, quantity, average_cost
        FROM holdings
        WHERE symbol = ?
        LIMIT 1
      `
    )
    .get(symbol) as HoldingSummaryRow | undefined;

  return row ?? null;
}

function upsertWatchlistSymbol(symbol: string, notes: string): void {
  db.prepare(
    `
      INSERT INTO watchlist (symbol, notes, updated_at)
      VALUES (@symbol, @notes, CURRENT_TIMESTAMP)
      ON CONFLICT(symbol) DO UPDATE SET
        notes = CASE WHEN excluded.notes != '' THEN excluded.notes ELSE watchlist.notes END,
        updated_at = CURRENT_TIMESTAMP
    `
  ).run({ symbol, notes });
}

export function removeFromWatchlistBySymbol(symbol: string): void {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return;
  }
  db.prepare("DELETE FROM watchlist WHERE symbol = ?").run(normalized);
}

export function listTrackedSymbols(): string[] {
  const rows = db
    .prepare(
      `
        SELECT symbol
        FROM holdings
        WHERE quantity > 0
        UNION
        SELECT symbol
        FROM watchlist
        ORDER BY symbol ASC
      `
    )
    .all() as Array<{ symbol: string }>;

  return rows.map((row) => row.symbol);
}

export function listWatchlistWithQuotes(): WatchlistItem[] {
  const rows = db
    .prepare(
      `
        SELECT
          w.id,
          w.symbol,
          w.notes,
          w.created_at,
          w.updated_at,
          i.name_en,
          i.name_zh,
          i.asset_type,
          i.issuer,
          i.currency,
          i.region
        FROM watchlist w
        INNER JOIN instruments i ON i.symbol = w.symbol
        ORDER BY w.created_at DESC, w.id DESC
      `
    )
    .all() as WatchlistRow[];

  const snapshots = getLatestSnapshots(rows.map((row) => row.symbol));

  return rows.map((row) => {
    const snapshot = snapshots.get(row.symbol);
    return {
      id: row.id,
      symbol: row.symbol,
      nameEn: row.name_en,
      nameZh: row.name_zh,
      assetType: row.asset_type,
      issuer: row.issuer,
      currency: row.currency,
      region: row.region,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      currentPrice: snapshot?.price ?? null,
      changeAmount: snapshot?.change_amount ?? null,
      changePercent: snapshot?.change_percent ?? null,
      priceAsOf: snapshot?.as_of ?? null,
      priceProvider: snapshot?.provider ?? null,
      priceStatus: snapshot ? "cached" : "missing"
    };
  });
}

export function addToWatchlist(input: { symbol: string; notes: string }): WatchlistItem {
  const symbol = normalizeSymbol(input.symbol);
  if (!symbol) {
    throw new Error("Symbol is required.");
  }

  const instrument = getInstrumentBySymbol(symbol);
  if (!instrument || !instrument.isActive) {
    throw new Error(`Instrument ${symbol} is not available in the local catalog.`);
  }

  const existingHolding = getHoldingBySymbol(symbol);
  if (existingHolding && existingHolding.quantity > 0) {
    throw new Error(`${symbol} is already in purchased holdings. Add a transaction instead.`);
  }

  upsertWatchlistSymbol(symbol, input.notes.trim());

  const item = listWatchlistWithQuotes().find((entry) => entry.symbol === symbol);
  if (!item) {
    throw new Error("Unable to load tracked instrument after save.");
  }

  return item;
}

export function removeWatchlistItem(id: number): boolean {
  const result = db.prepare("DELETE FROM watchlist WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listTransactions(options?: { symbol?: string; limit?: number }): TransactionRecord[] {
  const limit = Math.max(1, Math.min(options?.limit ?? 50, 500));
  const symbol = options?.symbol ? normalizeSymbol(options.symbol) : "";

  let rows: TransactionRow[];
  if (symbol) {
    rows = db
      .prepare(
        `
          SELECT *
          FROM transactions
          WHERE symbol = ?
          ORDER BY trade_date DESC, id DESC
          LIMIT ?
        `
      )
      .all(symbol, limit) as TransactionRow[];
  } else {
    rows = db
      .prepare(
        `
          SELECT *
          FROM transactions
          ORDER BY trade_date DESC, id DESC
          LIMIT ?
        `
      )
      .all(limit) as TransactionRow[];
  }

  return rows.map(mapTransaction);
}

export function createTransaction(input: {
  symbol: string;
  transactionType: TransactionType;
  quantity: number;
  price: number;
  fee: number;
  tradeDate: string | null;
  notes: string;
}): TransactionRecord {
  const symbol = normalizeSymbol(input.symbol);
  if (!symbol) {
    throw new Error("Symbol is required.");
  }

  const instrument = getInstrumentBySymbol(symbol);
  if (!instrument || !instrument.isActive) {
    throw new Error(`Instrument ${symbol} is not available in the local catalog.`);
  }

  const quantity = input.quantity;
  const price = input.price;
  const fee = input.fee;

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a valid number greater than zero.");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a valid non-negative number.");
  }
  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error("Fee must be a valid non-negative number.");
  }

  const tradeDate = (input.tradeDate ?? "").trim() || todayDateString();
  const notes = input.notes.trim();

  const insertTransactionStmt = db.prepare(
    `
      INSERT INTO transactions (
        symbol,
        transaction_type,
        quantity,
        price,
        fee,
        trade_date,
        notes,
        updated_at
      ) VALUES (
        @symbol,
        @transactionType,
        @quantity,
        @price,
        @fee,
        @tradeDate,
        @notes,
        CURRENT_TIMESTAMP
      )
    `
  );

  const transaction = db.transaction(() => {
    const existingHolding = getHoldingBySymbol(symbol);

    if (input.transactionType === "BUY") {
      const previousQuantity = existingHolding?.quantity ?? 0;
      const previousAverageCost = existingHolding?.average_cost ?? 0;
      const nextQuantity = previousQuantity + quantity;
      const nextAverageCost =
        nextQuantity === 0
          ? 0
          : (previousAverageCost * previousQuantity + price * quantity + fee) / nextQuantity;

      if (existingHolding) {
        db.prepare(
          `
            UPDATE holdings
            SET quantity = @quantity,
                average_cost = @averageCost,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = @id
          `
        ).run({
          id: existingHolding.id,
          quantity: nextQuantity,
          averageCost: nextAverageCost
        });
      } else {
        db.prepare(
          `
            INSERT INTO holdings (
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
              updated_at
            ) VALUES (
              @symbol,
              @name,
              @assetType,
              @quantity,
              @averageCost,
              @currency,
              @region,
              @strategyLabel,
              @riskGroup,
              @tags,
              @notes,
              CURRENT_TIMESTAMP
            )
          `
        ).run({
          symbol,
          name: instrument.nameEn,
          assetType: instrument.assetType,
          quantity,
          averageCost: (price * quantity + fee) / quantity,
          currency: instrument.currency,
          region: instrument.region,
          strategyLabel: inferStrategyLabel(instrument.assetType),
          riskGroup: inferRiskGroup(instrument.assetType),
          tags: stringifyTags(inferTags(instrument.assetType)),
          notes
        });
      }

      removeFromWatchlistBySymbol(symbol);
    } else {
      if (!existingHolding) {
        throw new Error(`Cannot SELL ${symbol}: no existing purchased holding found.`);
      }
      if (quantity > existingHolding.quantity) {
        throw new Error(
          `Cannot SELL ${quantity} units of ${symbol}: only ${existingHolding.quantity} units available.`
        );
      }

      const remaining = existingHolding.quantity - quantity;
      if (remaining <= 0) {
        db.prepare("DELETE FROM holdings WHERE id = ?").run(existingHolding.id);
        upsertWatchlistSymbol(symbol, "Auto-tracked after full SELL");
      } else {
        db.prepare(
          `
            UPDATE holdings
            SET quantity = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `
        ).run(remaining, existingHolding.id);
      }
    }

    const result = insertTransactionStmt.run({
      symbol,
      transactionType: input.transactionType,
      quantity,
      price,
      fee,
      tradeDate,
      notes
    });

    const created = db
      .prepare("SELECT * FROM transactions WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as TransactionRow | undefined;

    if (!created) {
      throw new Error("Unable to load created transaction.");
    }

    return mapTransaction(created);
  });

  return transaction();
}
