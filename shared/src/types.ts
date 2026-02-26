export type RefreshStatus = "idle" | "refreshing" | "success" | "failed";

export type QuoteProviderName = "yahoo" | "demo";

export interface Holding {
  id: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface ManualAsset {
  id: number;
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
  priceUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetSnapshot {
  symbol: string;
  price: number;
  changeAmount: number | null;
  changePercent: number | null;
  currency: string;
  provider: string;
  asOf: string;
  fetchedAt: string;
}

export interface DividendRecord {
  id: number;
  symbol: string;
  exDividendDate: string | null;
  paymentDate: string;
  dividendPerUnit: number;
  receivedAmount: number;
  currency: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PositionMetrics {
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedReturnPct: number;
  todayChange: number | null;
}

export interface HoldingWithMetrics extends Holding, PositionMetrics {
  priceAsOf: string | null;
}

export interface ManualAssetWithMetrics extends ManualAsset, PositionMetrics {
  priceAsOf: string;
}

export interface AllocationBucket {
  label: string;
  value: number;
  percentage: number;
}

export interface PortfolioSummary {
  totalMarketValue: number;
  totalCostBasis: number;
  totalUnrealizedPL: number;
  totalUnrealizedReturnPct: number;
  totalDividends: number;
  totalReturn: number;
  todayApproxChange: number;
  holdingsCount: number;
  manualAssetsCount: number;
  lastRefreshAt: string | null;
  lastRefreshProvider: string | null;
  lastRefreshError: string | null;
  lastRefreshStatus: RefreshStatus;
}

export interface PortfolioResponse {
  summary: PortfolioSummary;
  allocations: {
    byAssetType: AllocationBucket[];
    byRegion: AllocationBucket[];
    byStrategyLabel: AllocationBucket[];
    byRiskGroup: AllocationBucket[];
  };
  recentDividends: DividendRecord[];
}

export interface HoldingsResponse {
  holdings: HoldingWithMetrics[];
  manualAssets: ManualAssetWithMetrics[];
  refreshStatus: RefreshStatus;
  lastRefreshAt: string | null;
  lastRefreshProvider: string | null;
  lastRefreshError: string | null;
}

export interface DividendSummary {
  totalReceived: number;
  byAsset: Array<{
    symbol: string;
    totalReceived: number;
  }>;
}

export interface DividendsResponse {
  records: DividendRecord[];
  summary: DividendSummary;
}

export interface SettingsResponse {
  quoteProvider: QuoteProviderName;
  refreshTimeoutMs: number;
  refreshRetries: number;
  customTags: string[];
  baseCurrency: string;
  lastRefreshStatus: RefreshStatus;
  lastRefreshAt: string | null;
  lastRefreshProvider: string | null;
  lastRefreshError: string | null;
  enableDemoMode: boolean;
  allowDemoFallback: boolean;
}

export interface QuoteData {
  symbol: string;
  price: number;
  changeAmount: number | null;
  changePercent: number | null;
  currency: string;
  asOf: string;
  provider: string;
}

export interface QuoteError {
  symbol: string;
  message: string;
}

export interface RefreshResponse {
  status: RefreshStatus;
  refreshedAt: string | null;
  updatedSymbols: string[];
  failedSymbols: Array<{
    symbol: string;
    message: string;
  }>;
  message: string;
  provider: string;
}
