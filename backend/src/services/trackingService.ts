import { roundMoney, type TransactionFeeMode, type TransactionRecord, type TransactionType, type WatchlistItem } from "@portfolio/shared";
import db from "../db/client.js";
import { stringifyTags } from "../utils/parsers.js";
import { getInstrumentBySymbol } from "./instrumentService.js";
import { calculateHkTrade25Fees, normalizeManualFee, type TransactionFeeBreakdown } from "./tradeFeeService.js";

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

type HoldingMetadataRow = {
  symbol: string;
  name: string;
  asset_type: string;
  currency: string;
  region: string;
  strategy_label: string;
  risk_group: string;
  tags: string;
  notes: string;
};

type TransactionRow = {
  id: number;
  symbol: string;
  transaction_type: TransactionType;
  quantity: number;
  price: number;
  fee: number;
  fee_mode: TransactionFeeMode;
  brokerage_fee: number;
  stamp_duty: number;
  transaction_levy: number;
  trading_fee: number;
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
  const otherFee = roundMoney(
    Math.max(0, row.fee - (row.brokerage_fee + row.stamp_duty + row.transaction_levy + row.trading_fee))
  );

  return {
    id: row.id,
    symbol: row.symbol,
    transactionType: row.transaction_type,
    quantity: row.quantity,
    price: row.price,
    fee: row.fee,
    feeMode: row.fee_mode,
    brokerageFee: row.brokerage_fee,
    stampDuty: row.stamp_duty,
    transactionLevy: row.transaction_levy,
    tradingFee: row.trading_fee,
    otherFee,
    tradeDate: row.trade_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function resolveTransactionFees(input: {
  feeMode: TransactionFeeMode;
  quantity: number;
  price: number;
  fee: number;
  brokerageFee?: number;
  stampDuty?: number;
  transactionLevy?: number;
  tradingFee?: number;
  otherFee?: number;
}): TransactionFeeBreakdown {
  if (input.feeMode === "auto_hsbc_trade25") {
    return calculateHkTrade25Fees(roundMoney(input.quantity * input.price));
  }

  return normalizeManualFee({
    fee: input.fee,
    brokerageFee: input.brokerageFee,
    stampDuty: input.stampDuty,
    transactionLevy: input.transactionLevy,
    tradingFee: input.tradingFee,
    otherFee: input.otherFee
  });
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

function getTransactionRowById(id: number): TransactionRow | null {
  const row = db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as
    | TransactionRow
    | undefined;
  return row ?? null;
}

function getHoldingMetadataBySymbols(symbols: string[]): Map<string, HoldingMetadataRow> {
  if (symbols.length === 0) {
    return new Map();
  }

  const placeholders = symbols.map(() => "?").join(",");
  const rows = db
    .prepare(
      `
        SELECT
          symbol,
          name,
          asset_type,
          currency,
          region,
          strategy_label,
          risk_group,
          tags,
          notes
        FROM holdings
        WHERE symbol IN (${placeholders})
      `
    )
    .all(...symbols) as HoldingMetadataRow[];

  return new Map(rows.map((row) => [row.symbol, row]));
}

function rebuildHoldingsForSymbols(symbols: string[]): void {
  const normalizedSymbols = [...new Set(symbols.map(normalizeSymbol).filter((item) => item.length > 0))];
  if (normalizedSymbols.length === 0) {
    return;
  }

  const placeholders = normalizedSymbols.map(() => "?").join(",");
  const rows = db
    .prepare(
      `
        SELECT *
        FROM transactions
        WHERE symbol IN (${placeholders})
        ORDER BY symbol ASC, trade_date ASC, id ASC
      `
    )
    .all(...normalizedSymbols) as TransactionRow[];

  const metadataBySymbol = getHoldingMetadataBySymbols(normalizedSymbols);
  const grouped = new Map<string, TransactionRow[]>();
  for (const row of rows) {
    const group = grouped.get(row.symbol) ?? [];
    group.push(row);
    grouped.set(row.symbol, group);
  }

  db.prepare(`DELETE FROM holdings WHERE symbol IN (${placeholders})`).run(...normalizedSymbols);

  const insertHoldingStmt = db.prepare(
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
  );

  for (const symbol of normalizedSymbols) {
    const symbolRows = grouped.get(symbol) ?? [];
    if (symbolRows.length === 0) {
      continue;
    }

    let quantity = 0;
    let averageCost = 0;

    for (const row of symbolRows) {
      if (row.transaction_type === "BUY") {
        const nextQuantity = quantity + row.quantity;
        averageCost =
          nextQuantity === 0
            ? 0
            : (averageCost * quantity + row.price * row.quantity + row.fee) / nextQuantity;
        quantity = nextQuantity;
      } else {
        if (row.quantity > quantity) {
          throw new Error(
            `Invalid transaction history for ${symbol}: SELL quantity exceeds available position.`
          );
        }

        quantity -= row.quantity;
        if (quantity <= 0) {
          quantity = 0;
          averageCost = 0;
        }
      }
    }

    if (quantity <= 0) {
      upsertWatchlistSymbol(symbol, "Auto-tracked after full SELL");
      continue;
    }

    const instrument = getInstrumentBySymbol(symbol);
    const existing = metadataBySymbol.get(symbol);
    const assetType = existing?.asset_type ?? instrument?.assetType ?? "equity etf";

    insertHoldingStmt.run({
      symbol,
      name: existing?.name ?? instrument?.nameEn ?? symbol,
      assetType,
      quantity,
      averageCost,
      currency: existing?.currency ?? instrument?.currency ?? "HKD",
      region: existing?.region ?? instrument?.region ?? "Hong Kong",
      strategyLabel: existing?.strategy_label ?? inferStrategyLabel(assetType),
      riskGroup: existing?.risk_group ?? inferRiskGroup(assetType),
      tags: existing?.tags ?? stringifyTags(inferTags(assetType)),
      notes: existing?.notes ?? ""
    });

    removeFromWatchlistBySymbol(symbol);
  }
}

function validateTransactionFields(input: {
  quantity: number;
  price: number;
  fee: number;
}): void {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Quantity must be a valid number greater than zero.");
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new Error("Price must be a valid non-negative number.");
  }
  if (!Number.isFinite(input.fee) || input.fee < 0) {
    throw new Error("Fee must be a valid non-negative number.");
  }
}

export function createTransaction(input: {
  symbol: string;
  transactionType: TransactionType;
  quantity: number;
  price: number;
  fee: number;
  feeMode?: TransactionFeeMode;
  brokerageFee?: number;
  stampDuty?: number;
  transactionLevy?: number;
  tradingFee?: number;
  otherFee?: number;
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
  const feeMode = input.feeMode ?? "manual";

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a valid number greater than zero.");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Price must be a valid non-negative number.");
  }
  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error("Fee must be a valid non-negative number.");
  }

  const feeBreakdown = resolveTransactionFees({
    feeMode,
    quantity,
    price,
    fee,
    brokerageFee: input.brokerageFee,
    stampDuty: input.stampDuty,
    transactionLevy: input.transactionLevy,
    tradingFee: input.tradingFee,
    otherFee: input.otherFee
  });

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
        fee_mode,
        brokerage_fee,
        stamp_duty,
        transaction_levy,
        trading_fee,
        trade_date,
        notes,
        updated_at
      ) VALUES (
        @symbol,
        @transactionType,
        @quantity,
        @price,
        @fee,
        @feeMode,
        @brokerageFee,
        @stampDuty,
        @transactionLevy,
        @tradingFee,
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
          : (previousAverageCost * previousQuantity + price * quantity + feeBreakdown.fee) / nextQuantity;

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
          averageCost: (price * quantity + feeBreakdown.fee) / quantity,
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
      fee: feeBreakdown.fee,
      feeMode: feeBreakdown.feeMode,
      brokerageFee: feeBreakdown.brokerageFee,
      stampDuty: feeBreakdown.stampDuty,
      transactionLevy: feeBreakdown.transactionLevy,
      tradingFee: feeBreakdown.tradingFee,
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

export function updateTransaction(
  id: number,
  input: Partial<{
    symbol: string;
    transactionType: TransactionType;
    quantity: number;
    price: number;
    fee: number;
    feeMode: TransactionFeeMode;
    brokerageFee: number;
    stampDuty: number;
    transactionLevy: number;
    tradingFee: number;
    otherFee: number;
    tradeDate: string | null;
    notes: string;
  }>
): TransactionRecord | null {
  const existing = getTransactionRowById(id);
  if (!existing) {
    return null;
  }

  const symbol = normalizeSymbol(input.symbol ?? existing.symbol);
  const transactionType = input.transactionType ?? existing.transaction_type;
  const quantity = input.quantity ?? existing.quantity;
  const price = input.price ?? existing.price;
  const feeMode = input.feeMode ?? existing.fee_mode;
  const fee = input.fee ?? existing.fee;
  const existingOtherFee = roundMoney(
    Math.max(
      0,
      existing.fee -
        (existing.brokerage_fee + existing.stamp_duty + existing.transaction_levy + existing.trading_fee)
    )
  );
  const brokerageFee = input.brokerageFee ?? existing.brokerage_fee;
  const stampDuty = input.stampDuty ?? existing.stamp_duty;
  const transactionLevy = input.transactionLevy ?? existing.transaction_levy;
  const tradingFee = input.tradingFee ?? existing.trading_fee;
  const otherFee = input.otherFee ?? existingOtherFee;
  const tradeDate =
    input.tradeDate === undefined
      ? existing.trade_date
      : (input.tradeDate ?? "").trim() || todayDateString();
  const notes = input.notes === undefined ? existing.notes : input.notes.trim();

  validateTransactionFields({ quantity, price, fee });

  if (symbol !== existing.symbol) {
    const instrument = getInstrumentBySymbol(symbol);
    if (!instrument || !instrument.isActive) {
      throw new Error(`Instrument ${symbol} is not available in the local catalog.`);
    }
  }

  const feeBreakdown = resolveTransactionFees({
    feeMode,
    quantity,
    price,
    fee,
    brokerageFee,
    stampDuty,
    transactionLevy,
    tradingFee,
    otherFee
  });

  const tx = db.transaction(() => {
    db.prepare(
      `
        UPDATE transactions
        SET symbol = @symbol,
            transaction_type = @transactionType,
            quantity = @quantity,
            price = @price,
            fee = @fee,
            fee_mode = @feeMode,
            brokerage_fee = @brokerageFee,
            stamp_duty = @stampDuty,
            transaction_levy = @transactionLevy,
            trading_fee = @tradingFee,
            trade_date = @tradeDate,
            notes = @notes,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `
    ).run({
      id,
      symbol,
      transactionType,
      quantity,
      price,
      fee: feeBreakdown.fee,
      feeMode: feeBreakdown.feeMode,
      brokerageFee: feeBreakdown.brokerageFee,
      stampDuty: feeBreakdown.stampDuty,
      transactionLevy: feeBreakdown.transactionLevy,
      tradingFee: feeBreakdown.tradingFee,
      tradeDate,
      notes
    });

    rebuildHoldingsForSymbols([existing.symbol, symbol]);

    const updated = getTransactionRowById(id);
    if (!updated) {
      throw new Error("Unable to load updated transaction.");
    }

    return mapTransaction(updated);
  });

  return tx();
}

export function deleteTransaction(id: number): boolean {
  const existing = getTransactionRowById(id);
  if (!existing) {
    return false;
  }

  const tx = db.transaction(() => {
    const result = db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
    if (result.changes <= 0) {
      return false;
    }

    rebuildHoldingsForSymbols([existing.symbol]);
    return true;
  });

  return tx();
}
