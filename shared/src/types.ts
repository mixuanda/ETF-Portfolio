export type RefreshStatus = "idle" | "refreshing" | "success" | "partial_success" | "failed";

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
  status: "success" | "failed";
}

export interface DividendRecord {
  id: number;
  symbol: string;
  exDividendDate: string | null;
  paymentDate: string;
  eventLabel: string;
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
  priceProvider: string | null;
  priceStatus: "cached" | "missing";
}

export interface WatchlistItem {
  id: number;
  symbol: string;
  nameEn: string;
  nameZh: string;
  assetType: string;
  issuer: string;
  currency: string;
  region: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  currentPrice: number | null;
  changeAmount: number | null;
  changePercent: number | null;
  priceAsOf: string | null;
  priceProvider: string | null;
  priceStatus: "cached" | "missing";
}

export type TransactionType = "BUY" | "SELL";

export type TransactionFeeMode = "manual" | "auto_hsbc_trade25";

export interface TransactionRecord {
  id: number;
  symbol: string;
  transactionType: TransactionType;
  quantity: number;
  price: number;
  fee: number;
  feeMode: TransactionFeeMode;
  stampDutyExempt: boolean;
  brokerageFee: number;
  stampDuty: number;
  transactionLevy: number;
  tradingFee: number;
  otherFee: number;
  tradeDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchasedCostSummary {
  currentCostBasis: number;
  currentMarketValue: number;
  currentUnrealizedPL: number;
  cumulativeBuyAmount: number;
  cumulativeSellAmount: number;
  cumulativeDividends: number;
  brokerageFees: number;
  stampDuty: number;
  transactionLevy: number;
  tradingFees: number;
  otherFees: number;
  totalFees: number;
  netInvested: number;
  totalReturn: number;
}

export interface ManualAssetWithMetrics extends ManualAsset, PositionMetrics {
  priceAsOf: string;
  priceProvider: string;
  priceStatus: "cached";
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
  totalFees: number;
  realizedPL: number;
  totalReturn: number;
  totalReturnPct: number;
  todayApproxChange: number;
  todayReturnPct: number;
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
  watchlist: WatchlistItem[];
  manualAssets: ManualAssetWithMetrics[];
  transactions: TransactionRecord[];
  costSummary: PurchasedCostSummary;
  refreshStatus: RefreshStatus;
  lastRefreshAt: string | null;
  lastRefreshProvider: string | null;
  lastRefreshError: string | null;
}

export interface InstrumentSearchResult {
  symbol: string;
  nameEn: string;
  nameZh: string;
  assetType: string;
  issuer: string;
  currency: string;
  region: string;
  isActive: boolean;
}

export interface InstrumentDetail extends InstrumentSearchResult {
  searchKeywords: string;
}

export interface DividendSummary {
  totalReceived: number;
  yieldPct: number;
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
  enableHkexBackup: boolean;
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
  status: "success";
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
  symbolProviders: Array<{
    symbol: string;
    provider: string;
    quoteTime: string;
  }>;
  message: string;
  provider: string;
}
