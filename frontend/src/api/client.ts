import type {
  DividendRecord,
  DividendsResponse,
  HoldingWithMetrics,
  HoldingsResponse,
  InstrumentDetail,
  InstrumentSearchResult,
  ManualAssetWithMetrics,
  PortfolioResponse,
  RefreshResponse,
  SettingsResponse,
  TransactionRecord,
  WatchlistItem
} from "@portfolio/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: string }).message)
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export interface HoldingInput {
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
}

export type HoldingUpdateInput = Partial<HoldingInput>;

export interface ManualAssetInput {
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
}

export type ManualAssetUpdateInput = Partial<ManualAssetInput>;

export interface DividendInput {
  symbol: string;
  exDividendDate: string | null;
  paymentDate: string;
  dividendPerUnit: number;
  receivedAmount: number;
  currency: string;
  notes: string;
}

export type DividendUpdateInput = Partial<DividendInput>;

export interface WatchlistInput {
  symbol: string;
  notes: string;
}

export interface TransactionInput {
  symbol: string;
  transactionType: "BUY" | "SELL";
  quantity: number;
  price: number;
  fee?: number;
  tradeDate?: string | null;
  notes: string;
}

export interface SettingsEnvelope {
  settings: SettingsResponse;
  trackedSymbols: string[];
}

export interface SettingsUpdateInput {
  quoteProvider?: "yahoo" | "demo";
  refreshTimeoutMs?: number;
  refreshRetries?: number;
  customTags?: string[];
  baseCurrency?: string;
}

export const api = {
  getPortfolio: () => request<PortfolioResponse>("/api/portfolio"),
  getHoldings: () => request<HoldingsResponse>("/api/holdings"),
  refreshPrices: () => request<RefreshResponse>("/api/refresh", { method: "POST" }),

  searchInstruments: (query: string) =>
    request<{ results: InstrumentSearchResult[] }>(
      `/api/instruments/search?q=${encodeURIComponent(query.trim())}`
    ),

  getInstrument: (symbol: string) =>
    request<{ instrument: InstrumentDetail }>(`/api/instruments/${encodeURIComponent(symbol)}`),

  syncInstruments: () =>
    request<{
      syncedAt: string;
      updatedSymbols: string[];
      failedSymbols: Array<{ symbol: string; message: string }>;
    }>("/api/instruments/sync", {
      method: "POST"
    }),

  getFirebaseProgramStatus: () =>
    request<{
      enabled: boolean;
      configured: boolean;
      projectId: string | null;
      portfolioId: string;
      restoreOnBoot: boolean;
    }>("/api/firebase/status"),

  syncFirebaseProgram: () =>
    request<{
      syncedAt: string;
      projectId: string;
      portfolioId: string;
      trackedSymbolCount: number;
      purchaseCount: number;
      transactionCount: number;
    }>("/api/firebase/sync", {
      method: "POST"
    }),

  restoreFirebaseProgram: () =>
    request<{
      restored: boolean;
      restoredAt: string | null;
      reason?: string;
    }>("/api/firebase/restore", {
      method: "POST"
    }),

  createHolding: (body: HoldingInput) =>
    request<HoldingWithMetrics>("/api/holdings", {
      method: "POST",
      body: JSON.stringify(body)
    }),

  updateHolding: (id: number, body: HoldingUpdateInput) =>
    request<HoldingWithMetrics>(`/api/holdings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),

  deleteHolding: (id: number) =>
    request<void>(`/api/holdings/${id}`, {
      method: "DELETE"
    }),

  addToWatchlist: (body: WatchlistInput) =>
    request<WatchlistItem>("/api/watchlist", {
      method: "POST",
      body: JSON.stringify(body)
    }),

  deleteWatchlistItem: (id: number) =>
    request<void>(`/api/watchlist/${id}`, {
      method: "DELETE"
    }),

  getTransactions: (symbol?: string) =>
    request<{ transactions: TransactionRecord[] }>(
      symbol
        ? `/api/transactions?symbol=${encodeURIComponent(symbol)}`
        : "/api/transactions"
    ),

  createTransaction: (body: TransactionInput) =>
    request<TransactionRecord>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(body)
    }),

  createManualAsset: (body: ManualAssetInput) =>
    request<ManualAssetWithMetrics>("/api/manual-assets", {
      method: "POST",
      body: JSON.stringify(body)
    }),

  updateManualAsset: (id: number, body: ManualAssetUpdateInput) =>
    request<ManualAssetWithMetrics>(`/api/manual-assets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),

  deleteManualAsset: (id: number) =>
    request<void>(`/api/manual-assets/${id}`, {
      method: "DELETE"
    }),

  getDividends: () => request<DividendsResponse>("/api/dividends"),

  createDividend: (body: DividendInput) =>
    request<DividendRecord>("/api/dividends", {
      method: "POST",
      body: JSON.stringify(body)
    }),

  updateDividend: (id: number, body: DividendUpdateInput) =>
    request<DividendRecord>(`/api/dividends/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),

  deleteDividend: (id: number) =>
    request<void>(`/api/dividends/${id}`, {
      method: "DELETE"
    }),

  getSettings: () => request<SettingsEnvelope>("/api/settings"),

  updateSettings: (body: SettingsUpdateInput) =>
    request<SettingsResponse>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(body)
    })
};
