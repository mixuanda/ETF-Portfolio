import {
  buildAllocationBuckets,
  calculatePositionMetrics,
  roundMoney,
  roundPercent,
  type AllocationBucket,
  type AssetSnapshot,
  type DividendRecord,
  type DividendsResponse,
  type Holding,
  type HoldingWithMetrics,
  type HoldingsResponse,
  type ManualAsset,
  type ManualAssetWithMetrics,
  type PortfolioResponse,
  type PortfolioSummary,
  type QuoteData,
  type RefreshStatus
} from "@portfolio/shared";
import db from "../db/client.js";
import { getSettings } from "./settingsService.js";
import { parseTags, stringifyTags } from "../utils/parsers.js";
import {
  listTrackedSymbols as listTrackedSymbolsFromTracking,
  listTransactions,
  listWatchlistWithQuotes,
  removeFromWatchlistBySymbol
} from "./trackingService.js";

type HoldingRow = {
  id: number;
  symbol: string;
  name: string;
  asset_type: string;
  quantity: number;
  average_cost: number;
  currency: string;
  region: string;
  strategy_label: string;
  risk_group: string;
  tags: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type ManualAssetRow = {
  id: number;
  code: string;
  name: string;
  asset_type: string;
  quantity: number;
  average_cost: number;
  currency: string;
  manual_price: number;
  region: string;
  strategy_label: string;
  risk_group: string;
  tags: string;
  notes: string;
  price_updated_at: string;
  created_at: string;
  updated_at: string;
};

type SnapshotRow = {
  symbol: string;
  price: number;
  change_amount: number | null;
  change_percent: number | null;
  currency: string;
  provider: string;
  as_of: string;
  status: "success" | "failed";
  fetched_at: string;
};

type DividendRow = {
  id: number;
  symbol: string;
  ex_dividend_date: string | null;
  payment_date: string;
  dividend_per_unit: number;
  received_amount: number;
  currency: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

function mapHoldingRow(row: HoldingRow): Holding {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    assetType: row.asset_type,
    quantity: row.quantity,
    averageCost: row.average_cost,
    currency: row.currency,
    region: row.region,
    strategyLabel: row.strategy_label,
    riskGroup: row.risk_group,
    tags: parseTags(row.tags),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapManualAssetRow(row: ManualAssetRow): ManualAsset {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    assetType: row.asset_type,
    quantity: row.quantity,
    averageCost: row.average_cost,
    currency: row.currency,
    manualPrice: row.manual_price,
    region: row.region,
    strategyLabel: row.strategy_label,
    riskGroup: row.risk_group,
    tags: parseTags(row.tags),
    notes: row.notes,
    priceUpdatedAt: row.price_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSnapshotRow(row: SnapshotRow): AssetSnapshot {
  return {
    symbol: row.symbol,
    price: row.price,
    changeAmount: row.change_amount,
    changePercent: row.change_percent,
    currency: row.currency,
    provider: row.provider,
    asOf: row.as_of,
    status: row.status,
    fetchedAt: row.fetched_at
  };
}

function mapDividendRow(row: DividendRow): DividendRecord {
  return {
    id: row.id,
    symbol: row.symbol,
    exDividendDate: row.ex_dividend_date,
    paymentDate: row.payment_date,
    dividendPerUnit: row.dividend_per_unit,
    receivedAmount: row.received_amount,
    currency: row.currency,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getLatestSnapshots(symbols: string[]): Map<string, AssetSnapshot> {
  if (symbols.length === 0) {
    return new Map();
  }

  const placeholders = symbols.map(() => "?").join(",");
  const query = `
    SELECT s.symbol,
           s.price,
           s.change_amount,
           s.change_percent,
           s.currency,
           s.provider,
           s.as_of,
           s.status,
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
  `;

  const rows = db.prepare(query).all(...symbols) as SnapshotRow[];
  return new Map(rows.map((row) => [row.symbol, mapSnapshotRow(row)]));
}

function getHoldingRows(): HoldingRow[] {
  return db
    .prepare(
      `
        SELECT *
        FROM holdings
        ORDER BY symbol ASC
      `
    )
    .all() as HoldingRow[];
}

function getManualAssetRows(): ManualAssetRow[] {
  return db
    .prepare(
      `
        SELECT *
        FROM manual_assets
        ORDER BY code ASC
      `
    )
    .all() as ManualAssetRow[];
}

export function listHoldingsWithMetrics(): HoldingWithMetrics[] {
  const holdings = getHoldingRows().map(mapHoldingRow);
  const snapshots = getLatestSnapshots(holdings.map((item) => item.symbol));

  return holdings.map((holding) => {
    const snapshot = snapshots.get(holding.symbol);
    const fallbackPrice = holding.averageCost;

    const metrics = calculatePositionMetrics({
      quantity: holding.quantity,
      averageCost: holding.averageCost,
      currentPrice: snapshot?.price ?? fallbackPrice,
      changeAmount: snapshot?.changeAmount ?? null
    });

    return {
      ...holding,
      ...metrics,
      priceAsOf: snapshot?.asOf ?? null,
      priceProvider: snapshot?.provider ?? null,
      priceStatus: snapshot ? "cached" : "missing"
    };
  });
}

export function listManualAssetsWithMetrics(): ManualAssetWithMetrics[] {
  return getManualAssetRows().map((row) => {
    const asset = mapManualAssetRow(row);
    const metrics = calculatePositionMetrics({
      quantity: asset.quantity,
      averageCost: asset.averageCost,
      currentPrice: asset.manualPrice,
      changeAmount: null
    });

    return {
      ...asset,
      ...metrics,
      priceAsOf: asset.priceUpdatedAt,
      todayChange: null,
      priceProvider: "manual",
      priceStatus: "cached"
    };
  });
}

export function listHoldings(): HoldingsResponse {
  const settings = getSettings();
  return {
    holdings: listHoldingsWithMetrics(),
    watchlist: listWatchlistWithQuotes(),
    manualAssets: listManualAssetsWithMetrics(),
    transactions: listTransactions({ limit: 100 }),
    refreshStatus: settings.lastRefreshStatus,
    lastRefreshAt: settings.lastRefreshAt,
    lastRefreshProvider: settings.lastRefreshProvider,
    lastRefreshError: settings.lastRefreshError
  };
}

export function listTrackedSymbols(): string[] {
  return listTrackedSymbolsFromTracking();
}

export function saveQuoteSnapshots(quotes: QuoteData[], fetchedAt: string): void {
  if (quotes.length === 0) {
    return;
  }

  const insert = db.prepare(
    `
      INSERT INTO asset_snapshots (
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
        @symbol,
        @price,
        @changeAmount,
        @changePercent,
        @currency,
        @provider,
        @asOf,
        @status,
        @fetchedAt
      )
    `
  );

  const transaction = db.transaction((rows: QuoteData[], timestamp: string) => {
    for (const row of rows) {
      insert.run({
        ...row,
        fetchedAt: timestamp
      });
    }
  });

  transaction(quotes, fetchedAt);
}

export function listDividends(): DividendsResponse {
  const records = db
    .prepare(
      `
        SELECT *
        FROM dividends
        ORDER BY payment_date DESC, id DESC
      `
    )
    .all() as DividendRow[];

  const byAssetRows = db
    .prepare(
      `
        SELECT symbol, SUM(received_amount) AS total_received
        FROM dividends
        GROUP BY symbol
        ORDER BY total_received DESC
      `
    )
    .all() as Array<{ symbol: string; total_received: number }>;

  const totalReceived = byAssetRows.reduce((acc, row) => acc + row.total_received, 0);

  return {
    records: records.map(mapDividendRow),
    summary: {
      totalReceived: roundMoney(totalReceived),
      byAsset: byAssetRows.map((row) => ({
        symbol: row.symbol,
        totalReceived: roundMoney(row.total_received)
      }))
    }
  };
}

function buildPortfolioSummary(
  holdings: HoldingWithMetrics[],
  manualAssets: ManualAssetWithMetrics[],
  dividends: DividendsResponse,
  refreshStatus: RefreshStatus,
  lastRefreshAt: string | null,
  lastRefreshProvider: string | null,
  lastRefreshError: string | null
): PortfolioSummary {
  const allPositions = [...holdings, ...manualAssets];
  const totalMarketValue = allPositions.reduce((acc, position) => acc + position.marketValue, 0);
  const totalCostBasis = allPositions.reduce((acc, position) => acc + position.costBasis, 0);
  const totalUnrealizedPL = allPositions.reduce((acc, position) => acc + position.unrealizedPL, 0);
  const totalUnrealizedReturnPct =
    totalCostBasis === 0 ? 0 : roundPercent((totalUnrealizedPL / totalCostBasis) * 100);
  const todayApproxChange = holdings.reduce(
    (acc, position) => acc + (position.todayChange ?? 0),
    0
  );
  const totalDividends = dividends.summary.totalReceived;

  return {
    totalMarketValue: roundMoney(totalMarketValue),
    totalCostBasis: roundMoney(totalCostBasis),
    totalUnrealizedPL: roundMoney(totalUnrealizedPL),
    totalUnrealizedReturnPct,
    totalDividends: roundMoney(totalDividends),
    totalReturn: roundMoney(totalUnrealizedPL + totalDividends),
    todayApproxChange: roundMoney(todayApproxChange),
    holdingsCount: holdings.length,
    manualAssetsCount: manualAssets.length,
    lastRefreshAt,
    lastRefreshProvider,
    lastRefreshError,
    lastRefreshStatus: refreshStatus
  };
}

function toAllocationEntries(
  holdings: HoldingWithMetrics[],
  manualAssets: ManualAssetWithMetrics[],
  key: "assetType" | "region" | "strategyLabel" | "riskGroup"
): Array<{ label: string; value: number }> {
  const map = new Map<string, number>();
  const all = [...holdings, ...manualAssets];

  for (const position of all) {
    const label = position[key] || "Unclassified";
    map.set(label, (map.get(label) ?? 0) + position.marketValue);
  }

  return [...map.entries()].map(([label, value]) => ({ label, value }));
}

export function getPortfolioSnapshot(): PortfolioResponse {
  const holdings = listHoldingsWithMetrics();
  const manualAssets = listManualAssetsWithMetrics();
  const dividends = listDividends();
  const settings = getSettings();

  const summary = buildPortfolioSummary(
    holdings,
    manualAssets,
    dividends,
    settings.lastRefreshStatus,
    settings.lastRefreshAt,
    settings.lastRefreshProvider,
    settings.lastRefreshError
  );

  const totalValue = summary.totalMarketValue;

  const byAssetType = buildAllocationBuckets(
    toAllocationEntries(holdings, manualAssets, "assetType"),
    totalValue
  );
  const byRegion = buildAllocationBuckets(
    toAllocationEntries(holdings, manualAssets, "region"),
    totalValue
  );
  const byStrategyLabel = buildAllocationBuckets(
    toAllocationEntries(holdings, manualAssets, "strategyLabel"),
    totalValue
  );
  const byRiskGroup = buildAllocationBuckets(
    toAllocationEntries(holdings, manualAssets, "riskGroup"),
    totalValue
  );

  const recentDividends = dividends.records.slice(0, 5);

  return {
    summary,
    allocations: {
      byAssetType,
      byRegion,
      byStrategyLabel,
      byRiskGroup
    },
    recentDividends
  };
}

function getHoldingWithMetricsById(id: number): HoldingWithMetrics | null {
  const holdings = listHoldingsWithMetrics();
  return holdings.find((item) => item.id === id) ?? null;
}

function getManualAssetWithMetricsById(id: number): ManualAssetWithMetrics | null {
  const assets = listManualAssetsWithMetrics();
  return assets.find((item) => item.id === id) ?? null;
}

function getDividendById(id: number): DividendRecord | null {
  const row = db.prepare("SELECT * FROM dividends WHERE id = ?").get(id) as DividendRow | undefined;
  if (!row) {
    return null;
  }
  return mapDividendRow(row);
}

export function createHolding(input: {
  symbol: string;
  name: string;
  assetType: string;
  quantity: number;
  averageCost: number;
  currency: string;
  region: string;
  strategyLabel: string;
  riskGroup: string;
  tags: string[];
  notes: string;
}): HoldingWithMetrics {
  const normalizedSymbol = input.symbol.trim().toUpperCase();

  const result = db
    .prepare(
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
    )
    .run({
      ...input,
      symbol: normalizedSymbol,
      tags: stringifyTags(input.tags)
    });

  removeFromWatchlistBySymbol(normalizedSymbol);

  const created = getHoldingWithMetricsById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("Unable to load created holding");
  }
  return created;
}

export function updateHolding(
  id: number,
  input: Partial<{
    symbol: string;
    name: string;
    assetType: string;
    quantity: number;
    averageCost: number;
    currency: string;
    region: string;
    strategyLabel: string;
    riskGroup: string;
    tags: string[];
    notes: string;
  }>
): HoldingWithMetrics | null {
  const updates: string[] = [];
  const params: Record<string, unknown> = { id };

  if (input.symbol !== undefined) {
    updates.push("symbol = @symbol");
    params.symbol = input.symbol;
  }
  if (input.name !== undefined) {
    updates.push("name = @name");
    params.name = input.name;
  }
  if (input.assetType !== undefined) {
    updates.push("asset_type = @assetType");
    params.assetType = input.assetType;
  }
  if (input.quantity !== undefined) {
    updates.push("quantity = @quantity");
    params.quantity = input.quantity;
  }
  if (input.averageCost !== undefined) {
    updates.push("average_cost = @averageCost");
    params.averageCost = input.averageCost;
  }
  if (input.currency !== undefined) {
    updates.push("currency = @currency");
    params.currency = input.currency;
  }
  if (input.region !== undefined) {
    updates.push("region = @region");
    params.region = input.region;
  }
  if (input.strategyLabel !== undefined) {
    updates.push("strategy_label = @strategyLabel");
    params.strategyLabel = input.strategyLabel;
  }
  if (input.riskGroup !== undefined) {
    updates.push("risk_group = @riskGroup");
    params.riskGroup = input.riskGroup;
  }
  if (input.tags !== undefined) {
    updates.push("tags = @tags");
    params.tags = stringifyTags(input.tags);
  }
  if (input.notes !== undefined) {
    updates.push("notes = @notes");
    params.notes = input.notes;
  }

  if (updates.length > 0) {
    updates.push("updated_at = CURRENT_TIMESTAMP");
    const query = `UPDATE holdings SET ${updates.join(", ")} WHERE id = @id`;
    db.prepare(query).run(params);
  }

  const updated = getHoldingWithMetricsById(id);
  if (updated && updated.quantity > 0) {
    removeFromWatchlistBySymbol(updated.symbol);
  }

  return updated;
}

export function deleteHolding(id: number): boolean {
  const result = db.prepare("DELETE FROM holdings WHERE id = ?").run(id);
  return result.changes > 0;
}

export function createManualAsset(input: {
  code: string;
  name: string;
  assetType: string;
  quantity: number;
  averageCost: number;
  currency: string;
  manualPrice: number;
  region: string;
  strategyLabel: string;
  riskGroup: string;
  tags: string[];
  notes: string;
}): ManualAssetWithMetrics {
  const result = db
    .prepare(
      `
        INSERT INTO manual_assets (
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
          updated_at
        ) VALUES (
          @code,
          @name,
          @assetType,
          @quantity,
          @averageCost,
          @currency,
          @manualPrice,
          @region,
          @strategyLabel,
          @riskGroup,
          @tags,
          @notes,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `
    )
    .run({
      ...input,
      tags: stringifyTags(input.tags)
    });

  const created = getManualAssetWithMetricsById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("Unable to load created manual asset");
  }
  return created;
}

export function updateManualAsset(
  id: number,
  input: Partial<{
    code: string;
    name: string;
    assetType: string;
    quantity: number;
    averageCost: number;
    currency: string;
    manualPrice: number;
    region: string;
    strategyLabel: string;
    riskGroup: string;
    tags: string[];
    notes: string;
  }>
): ManualAssetWithMetrics | null {
  const updates: string[] = [];
  const params: Record<string, unknown> = { id };
  let priceUpdated = false;

  if (input.code !== undefined) {
    updates.push("code = @code");
    params.code = input.code;
  }
  if (input.name !== undefined) {
    updates.push("name = @name");
    params.name = input.name;
  }
  if (input.assetType !== undefined) {
    updates.push("asset_type = @assetType");
    params.assetType = input.assetType;
  }
  if (input.quantity !== undefined) {
    updates.push("quantity = @quantity");
    params.quantity = input.quantity;
  }
  if (input.averageCost !== undefined) {
    updates.push("average_cost = @averageCost");
    params.averageCost = input.averageCost;
  }
  if (input.currency !== undefined) {
    updates.push("currency = @currency");
    params.currency = input.currency;
  }
  if (input.manualPrice !== undefined) {
    updates.push("manual_price = @manualPrice");
    params.manualPrice = input.manualPrice;
    priceUpdated = true;
  }
  if (input.region !== undefined) {
    updates.push("region = @region");
    params.region = input.region;
  }
  if (input.strategyLabel !== undefined) {
    updates.push("strategy_label = @strategyLabel");
    params.strategyLabel = input.strategyLabel;
  }
  if (input.riskGroup !== undefined) {
    updates.push("risk_group = @riskGroup");
    params.riskGroup = input.riskGroup;
  }
  if (input.tags !== undefined) {
    updates.push("tags = @tags");
    params.tags = stringifyTags(input.tags);
  }
  if (input.notes !== undefined) {
    updates.push("notes = @notes");
    params.notes = input.notes;
  }

  if (updates.length > 0) {
    if (priceUpdated) {
      updates.push("price_updated_at = CURRENT_TIMESTAMP");
    }
    updates.push("updated_at = CURRENT_TIMESTAMP");
    const query = `UPDATE manual_assets SET ${updates.join(", ")} WHERE id = @id`;
    db.prepare(query).run(params);
  }

  return getManualAssetWithMetricsById(id);
}

export function deleteManualAsset(id: number): boolean {
  const result = db.prepare("DELETE FROM manual_assets WHERE id = ?").run(id);
  return result.changes > 0;
}

export function createDividend(input: {
  symbol: string;
  exDividendDate: string | null;
  paymentDate: string;
  dividendPerUnit: number;
  receivedAmount: number;
  currency: string;
  notes: string;
}): DividendRecord {
  const result = db
    .prepare(
      `
        INSERT INTO dividends (
          symbol,
          ex_dividend_date,
          payment_date,
          dividend_per_unit,
          received_amount,
          currency,
          notes,
          updated_at
        ) VALUES (
          @symbol,
          @exDividendDate,
          @paymentDate,
          @dividendPerUnit,
          @receivedAmount,
          @currency,
          @notes,
          CURRENT_TIMESTAMP
        )
      `
    )
    .run(input);

  const created = getDividendById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("Unable to load created dividend");
  }
  return created;
}

export function updateDividend(
  id: number,
  input: Partial<{
    symbol: string;
    exDividendDate: string | null;
    paymentDate: string;
    dividendPerUnit: number;
    receivedAmount: number;
    currency: string;
    notes: string;
  }>
): DividendRecord | null {
  const updates: string[] = [];
  const params: Record<string, unknown> = { id };

  if (input.symbol !== undefined) {
    updates.push("symbol = @symbol");
    params.symbol = input.symbol;
  }
  if (input.exDividendDate !== undefined) {
    updates.push("ex_dividend_date = @exDividendDate");
    params.exDividendDate = input.exDividendDate;
  }
  if (input.paymentDate !== undefined) {
    updates.push("payment_date = @paymentDate");
    params.paymentDate = input.paymentDate;
  }
  if (input.dividendPerUnit !== undefined) {
    updates.push("dividend_per_unit = @dividendPerUnit");
    params.dividendPerUnit = input.dividendPerUnit;
  }
  if (input.receivedAmount !== undefined) {
    updates.push("received_amount = @receivedAmount");
    params.receivedAmount = input.receivedAmount;
  }
  if (input.currency !== undefined) {
    updates.push("currency = @currency");
    params.currency = input.currency;
  }
  if (input.notes !== undefined) {
    updates.push("notes = @notes");
    params.notes = input.notes;
  }

  if (updates.length > 0) {
    updates.push("updated_at = CURRENT_TIMESTAMP");
    const query = `UPDATE dividends SET ${updates.join(", ")} WHERE id = @id`;
    db.prepare(query).run(params);
  }

  return getDividendById(id);
}

export function deleteDividend(id: number): boolean {
  const result = db.prepare("DELETE FROM dividends WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getAnalysisTotals(): {
  totalReturn: number;
  totalDividends: number;
  totalUnrealizedPL: number;
  byAssetType: AllocationBucket[];
  byRegion: AllocationBucket[];
  byStrategyLabel: AllocationBucket[];
  byRiskGroup: AllocationBucket[];
} {
  const snapshot = getPortfolioSnapshot();
  return {
    totalReturn: snapshot.summary.totalReturn,
    totalDividends: snapshot.summary.totalDividends,
    totalUnrealizedPL: snapshot.summary.totalUnrealizedPL,
    byAssetType: snapshot.allocations.byAssetType,
    byRegion: snapshot.allocations.byRegion,
    byStrategyLabel: snapshot.allocations.byStrategyLabel,
    byRiskGroup: snapshot.allocations.byRiskGroup
  };
}
