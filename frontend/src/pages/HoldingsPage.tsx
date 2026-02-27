import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  HoldingsResponse,
  InstrumentSearchResult,
  RefreshStatus,
  TransactionFeeMode,
  TransactionType
} from "@portfolio/shared";
import { api } from "../api/client";
import { RefreshPanel } from "../components/RefreshPanel";
import { useRefreshPrices } from "../hooks/useRefreshPrices";
import { useI18n } from "../i18n/provider";
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
  formatSignedCurrency,
  numberTone
} from "../utils/format";

interface ManualAssetFormState {
  code: string;
  name: string;
  assetType: string;
  quantity: string;
  averageCost: string;
  manualPrice: string;
  currency: string;
  region: string;
  strategyLabel: string;
  riskGroup: string;
  tags: string;
  notes: string;
}

interface FirstBuyFormState {
  quantity: string;
  price: string;
  feeMode: TransactionFeeMode;
  fee: string;
  tradeDate: string;
  notes: string;
}

interface TransactionFormState {
  symbol: string;
  transactionType: TransactionType;
  feeMode: TransactionFeeMode;
  quantity: string;
  price: string;
  fee: string;
  tradeDate: string;
  notes: string;
}

interface HoldingEditFormState {
  quantity: string;
  averageCost: string;
}

const defaultManualAssetForm: ManualAssetFormState = {
  code: "",
  name: "",
  assetType: "fund",
  quantity: "1",
  averageCost: "",
  manualPrice: "",
  currency: "HKD",
  region: "Global",
  strategyLabel: "manual",
  riskGroup: "defensive",
  tags: "defensive",
  notes: ""
};

const defaultFirstBuyForm: FirstBuyFormState = {
  quantity: "",
  price: "",
  feeMode: "manual",
  fee: "0",
  tradeDate: "",
  notes: ""
};

const defaultTransactionForm: TransactionFormState = {
  symbol: "",
  transactionType: "BUY",
  feeMode: "manual",
  quantity: "",
  price: "",
  fee: "0",
  tradeDate: "",
  notes: ""
};

const defaultHoldingEditForm: HoldingEditFormState = {
  quantity: "",
  averageCost: ""
};

function toTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index);
}

function toTagInput(tags: string[]): string {
  return tags.join(", ");
}

function instrumentDisplayName(item: InstrumentSearchResult): string {
  return item.nameZh ? `${item.nameEn} / ${item.nameZh}` : item.nameEn;
}

function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function calculateAutoTrade25FeePreview(quantity: number, price: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
    return 0;
  }

  const amount = quantity * price;
  if (amount <= 0) {
    return 0;
  }

  const brokerage = 25;
  const stampDuty = Math.ceil(amount * 0.001);
  const transactionLevy = roundMoney(amount * 0.0000285);
  const tradingFee = roundMoney(amount * 0.0000565);
  return roundMoney(brokerage + stampDuty + transactionLevy + tradingFee);
}

export function HoldingsPage(): JSX.Element {
  const { t } = useI18n();
  const [data, setData] = useState<HoldingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InstrumentSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentSearchResult | null>(null);
  const [purchaseDecision, setPurchaseDecision] = useState<"yes" | "no" | null>(null);
  const [watchlistNote, setWatchlistNote] = useState("");
  const [firstBuyForm, setFirstBuyForm] = useState<FirstBuyFormState>(defaultFirstBuyForm);
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(defaultTransactionForm);
  const [holdingEditForm, setHoldingEditForm] = useState<HoldingEditFormState>(defaultHoldingEditForm);
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null);
  const [editingHoldingSymbol, setEditingHoldingSymbol] = useState("");

  const [manualForm, setManualForm] = useState<ManualAssetFormState>(defaultManualAssetForm);
  const [editingManualId, setEditingManualId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.getHoldings();
      setData(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("common.notAvailable"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchOpen(false);
      setActiveSearchIndex(-1);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await api.searchInstruments(query);
        if (!active) {
          return;
        }
        setSearchResults(response.results);
        setSearchOpen(true);
        setActiveSearchIndex(response.results.length > 0 ? 0 : -1);
      } catch {
        if (!active) {
          return;
        }
        setSearchResults([]);
        setSearchOpen(false);
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const { refreshStatus, refreshMessage, isRefreshing, triggerRefresh } = useRefreshPrices(loadData);

  const effectiveStatus: RefreshStatus =
    refreshStatus === "idle" && data ? data.refreshStatus : refreshStatus;

  const displayedRefreshMessage =
    refreshStatus === "idle"
      ? effectiveStatus === "failed" || effectiveStatus === "partial_success"
        ? data?.lastRefreshError ?? t("holdings.refreshFailedFallback")
        : t("holdings.refreshIdle")
      : refreshMessage;

  const totals = useMemo(() => {
    if (!data) {
      return {
        marketValue: 0,
        unrealized: 0
      };
    }

    const allPositions = [...data.holdings, ...data.manualAssets];
    return {
      marketValue: allPositions.reduce((acc, item) => acc + item.marketValue, 0),
      unrealized: allPositions.reduce((acc, item) => acc + item.unrealizedPL, 0)
    };
  }, [data]);

  const autoFeePreview = useMemo(() => {
    const quantity = Number(transactionForm.quantity);
    const price = Number(transactionForm.price);
    return calculateAutoTrade25FeePreview(quantity, price);
  }, [transactionForm.price, transactionForm.quantity]);

  const firstBuyAutoFeePreview = useMemo(() => {
    const quantity = Number(firstBuyForm.quantity);
    const price = Number(firstBuyForm.price);
    return calculateAutoTrade25FeePreview(quantity, price);
  }, [firstBuyForm.price, firstBuyForm.quantity]);

  function transactionTypeLabel(value: TransactionType): string {
    return value === "SELL" ? t("holdings.transaction.sell") : t("holdings.transaction.buy");
  }

  function transactionFeeModeLabel(value: TransactionFeeMode): string {
    return value === "auto_hsbc_trade25"
      ? t("holdings.feeMode.autoTrade25")
      : t("holdings.feeMode.manual");
  }

  function clearSelection(): void {
    setSelectedInstrument(null);
    setPurchaseDecision(null);
    setWatchlistNote("");
    setFirstBuyForm(defaultFirstBuyForm);
  }

  function selectInstrument(item: InstrumentSearchResult): void {
    setSelectedInstrument(item);
    setPurchaseDecision(null);
    setWatchlistNote("");
    setFirstBuyForm(defaultFirstBuyForm);
    setSearchOpen(false);
    setActiveSearchIndex(-1);
    setFormError(null);
    setSuccessMessage(null);
  }

  async function handleAddToWatchlist(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedInstrument) {
      return;
    }

    setFormError(null);
    setSuccessMessage(null);

    try {
      await api.addToWatchlist({
        symbol: selectedInstrument.symbol,
        notes: watchlistNote.trim()
      });
      setSuccessMessage(t("holdings.success.watchlistAdded", { symbol: selectedInstrument.symbol }));
      clearSelection();
      setSearchQuery("");
      setSearchResults([]);
      await loadData();
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : t("holdings.error.addWatchlist")
      );
    }
  }

  async function handleFirstBuySubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedInstrument) {
      return;
    }

    setFormError(null);
    setSuccessMessage(null);

    const quantity = Number(firstBuyForm.quantity);
    const price = Number(firstBuyForm.price);
    const fee = Number(firstBuyForm.fee || "0");

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError(t("holdings.error.quantityPositive"));
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError(t("holdings.error.buyPriceInvalid"));
      return;
    }
    if (firstBuyForm.feeMode === "manual" && (!Number.isFinite(fee) || fee < 0)) {
      setFormError(t("holdings.error.feeInvalid"));
      return;
    }

    try {
      await api.createTransaction({
        symbol: selectedInstrument.symbol,
        transactionType: "BUY",
        quantity,
        price,
        feeMode: firstBuyForm.feeMode,
        fee: firstBuyForm.feeMode === "manual" ? fee : 0,
        tradeDate: firstBuyForm.tradeDate || null,
        notes: firstBuyForm.notes.trim()
      });

      setSuccessMessage(t("holdings.success.firstBuyAdded", { symbol: selectedInstrument.symbol }));
      clearSelection();
      setSearchQuery("");
      setSearchResults([]);
      await loadData();
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : t("holdings.error.createTransaction")
      );
    }
  }

  function openTransactionForm(input: {
    symbol: string;
    type?: TransactionType;
    priceHint?: number | null;
  }): void {
    setTransactionForm({
      symbol: input.symbol,
      transactionType: input.type ?? "BUY",
      feeMode: "manual",
      quantity: "",
      price: input.priceHint != null ? String(input.priceHint) : "",
      fee: "0",
      tradeDate: "",
      notes: ""
    });
    setFormError(null);
    setSuccessMessage(null);
  }

  function openHoldingEditForm(input: { id: number; symbol: string; quantity: number; averageCost: number }): void {
    setEditingHoldingId(input.id);
    setEditingHoldingSymbol(input.symbol);
    setHoldingEditForm({
      quantity: String(input.quantity),
      averageCost: String(input.averageCost)
    });
    setFormError(null);
    setSuccessMessage(null);
  }

  function resetHoldingEditForm(): void {
    setEditingHoldingId(null);
    setEditingHoldingSymbol("");
    setHoldingEditForm(defaultHoldingEditForm);
  }

  async function handleTransactionSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const quantity = Number(transactionForm.quantity);
    const price = Number(transactionForm.price);
    const fee = Number(transactionForm.fee || "0");

    if (!transactionForm.symbol) {
      setFormError(t("holdings.error.chooseSymbol"));
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError(t("holdings.error.quantityPositive"));
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError(t("holdings.error.priceInvalid"));
      return;
    }
    if (transactionForm.feeMode === "manual" && (!Number.isFinite(fee) || fee < 0)) {
      setFormError(t("holdings.error.feeInvalid"));
      return;
    }

    try {
      await api.createTransaction({
        symbol: transactionForm.symbol,
        transactionType: transactionForm.transactionType,
        quantity,
        price,
        feeMode: transactionForm.feeMode,
        fee: transactionForm.feeMode === "manual" ? fee : 0,
        tradeDate: transactionForm.tradeDate || null,
        notes: transactionForm.notes.trim()
      });

      setSuccessMessage(
        t("holdings.success.transactionAdded", {
          type: transactionTypeLabel(transactionForm.transactionType),
          symbol: transactionForm.symbol
        })
      );
      setTransactionForm(defaultTransactionForm);
      await loadData();
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : t("holdings.error.createTransaction")
      );
    }
  }

  async function handleHoldingEditSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!editingHoldingId) {
      return;
    }

    setFormError(null);
    setSuccessMessage(null);

    const quantity = Number(holdingEditForm.quantity);
    const averageCost = Number(holdingEditForm.averageCost);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError(t("holdings.error.editQuantityPositive"));
      return;
    }

    if (!Number.isFinite(averageCost) || averageCost < 0) {
      setFormError(t("holdings.error.editAvgCostInvalid"));
      return;
    }

    try {
      await api.updateHolding(editingHoldingId, {
        quantity,
        averageCost
      });
      setSuccessMessage(t("holdings.success.holdingUpdated", { symbol: editingHoldingSymbol }));
      resetHoldingEditForm();
      await loadData();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : t("holdings.error.updateHolding"));
    }
  }

  async function handleDeleteHolding(id: number): Promise<void> {
    if (!window.confirm(t("holdings.confirm.deleteHolding"))) {
      return;
    }
    try {
      setFormError(null);
      setSuccessMessage(null);
      await api.deleteHolding(id);
      await loadData();
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : t("holdings.error.deleteHolding"));
    }
  }

  async function handleDeleteWatchlist(id: number): Promise<void> {
    if (!window.confirm(t("holdings.confirm.removeWatchlist"))) {
      return;
    }

    try {
      setFormError(null);
      setSuccessMessage(null);
      await api.deleteWatchlistItem(id);
      await loadData();
    } catch (deleteError) {
      setFormError(
        deleteError instanceof Error ? deleteError.message : t("holdings.error.removeWatchlist")
      );
    }
  }

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const quantity = Number(manualForm.quantity);
    const averageCost = Number(manualForm.averageCost);
    const manualPrice = Number(manualForm.manualPrice);

    if (!manualForm.code.trim() || !manualForm.name.trim()) {
      setFormError(t("holdings.error.manualRequired"));
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      !Number.isFinite(averageCost) ||
      averageCost < 0 ||
      !Number.isFinite(manualPrice) ||
      manualPrice < 0
    ) {
      setFormError(t("holdings.error.manualNumericInvalid"));
      return;
    }

    const payload = {
      code: manualForm.code.trim().toUpperCase(),
      name: manualForm.name.trim(),
      assetType: manualForm.assetType.trim(),
      quantity,
      averageCost,
      manualPrice,
      currency: manualForm.currency.trim().toUpperCase(),
      region: manualForm.region.trim(),
      strategyLabel: manualForm.strategyLabel.trim(),
      riskGroup: manualForm.riskGroup.trim(),
      tags: toTags(manualForm.tags),
      notes: manualForm.notes.trim()
    };

    try {
      if (editingManualId) {
        await api.updateManualAsset(editingManualId, payload);
        setSuccessMessage(t("holdings.success.manualUpdated"));
      } else {
        await api.createManualAsset(payload);
        setSuccessMessage(t("holdings.success.manualAdded"));
      }
      setManualForm(defaultManualAssetForm);
      setEditingManualId(null);
      await loadData();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : t("holdings.error.saveManual"));
    }
  }

  async function handleDeleteManualAsset(id: number): Promise<void> {
    if (!window.confirm(t("holdings.confirm.deleteManual"))) {
      return;
    }

    try {
      setFormError(null);
      setSuccessMessage(null);
      await api.deleteManualAsset(id);
      await loadData();
    } catch (deleteError) {
      setFormError(
        deleteError instanceof Error ? deleteError.message : t("holdings.error.deleteManual")
      );
    }
  }

  if (loading) {
    return <p>{t("common.loadingHoldings")}</p>;
  }

  if (error || !data) {
    return <p className="error">{error ?? t("common.notAvailable")}</p>;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <h2>{t("holdings.title")}</h2>
        <p className="muted">
          {t("holdings.subtitle", {
            value: formatCurrency(totals.marketValue)
          })}
        </p>
      </div>

      <RefreshPanel
        status={effectiveStatus}
        message={displayedRefreshMessage}
        lastRefreshAt={data.lastRefreshAt}
        lastRefreshProvider={data.lastRefreshProvider}
        onRefresh={triggerRefresh}
        disabled={isRefreshing}
      />

      {formError ? <p className="error">{formError}</p> : null}
      {successMessage ? <p className="success">{successMessage}</p> : null}

      <section className="panel">
        <h3>{t("holdings.searchAdd")}</h3>
        <p className="muted">{t("holdings.searchAddDesc")}</p>

        <label>
          {t("holdings.searchLabel")}
          <input
            value={searchQuery}
            placeholder={t("holdings.searchPlaceholder")}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              clearSelection();
            }}
            onFocus={() => {
              if (searchResults.length > 0) {
                setSearchOpen(true);
              }
            }}
            onKeyDown={(event) => {
              if (!searchOpen || searchResults.length === 0) {
                return;
              }

              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveSearchIndex((prev) => (prev + 1) % searchResults.length);
                return;
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveSearchIndex((prev) =>
                  prev <= 0 ? searchResults.length - 1 : (prev - 1) % searchResults.length
                );
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();
                if (activeSearchIndex >= 0 && activeSearchIndex < searchResults.length) {
                  const selected = searchResults[activeSearchIndex];
                  if (selected) {
                    selectInstrument(selected);
                  }
                }
                return;
              }

              if (event.key === "Escape") {
                setSearchOpen(false);
              }
            }}
          />
        </label>

        {searchLoading ? <p className="muted">{t("holdings.searching")}</p> : null}

        {searchOpen && searchQuery.trim() ? (
          <div className="search-results-wrap">
            {searchResults.length === 0 ? (
              <p className="muted">{t("holdings.searchNoMatch")}</p>
            ) : (
              <ul className="search-results">
                {searchResults.map((item, index) => (
                  <li key={item.symbol}>
                    <button
                      type="button"
                      className={
                        index === activeSearchIndex
                          ? "search-result search-result--active"
                          : "search-result"
                      }
                      onMouseDown={() => selectInstrument(item)}
                    >
                      <strong>{item.symbol}</strong>
                      <span>{instrumentDisplayName(item)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {selectedInstrument ? (
          <div className="instrument-preview">
            <h4>
              {selectedInstrument.symbol} - {selectedInstrument.nameEn}
            </h4>
            {selectedInstrument.nameZh ? <p className="muted">{selectedInstrument.nameZh}</p> : null}
            <p className="muted">
              {selectedInstrument.assetType} · {selectedInstrument.issuer || t("holdings.issuerNA")} ·{" "}
              {selectedInstrument.currency} · {selectedInstrument.region}
            </p>

            <div className="row-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setPurchaseDecision("yes")}
              >
                {t("holdings.boughtYes")}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setPurchaseDecision("no")}
              >
                {t("holdings.boughtNo")}
              </button>
              <button type="button" className="btn btn--ghost" onClick={clearSelection}>
                {t("holdings.clear")}
              </button>
            </div>
          </div>
        ) : null}

        {selectedInstrument && purchaseDecision === "no" ? (
          <form className="data-form" onSubmit={(event) => void handleAddToWatchlist(event)}>
            <h4>{t("holdings.watchlistAdd")}</h4>
            <label>
              {t("holdings.optionalNote")}
              <input
                value={watchlistNote}
                onChange={(event) => setWatchlistNote(event.target.value)}
                placeholder={t("holdings.notePlaceholder")}
              />
            </label>
            <div className="row-actions">
              <button type="submit" className="btn btn--primary">
                {t("holdings.saveTrackedOnly")}
              </button>
            </div>
          </form>
        ) : null}

        {selectedInstrument && purchaseDecision === "yes" ? (
          <form className="data-form" onSubmit={(event) => void handleFirstBuySubmit(event)}>
            <h4>{t("holdings.recordFirstBuy")}</h4>
            <div className="form-grid">
              <label>
                {t("holdings.quantity")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={firstBuyForm.quantity}
                  onChange={(event) =>
                    setFirstBuyForm((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                />
              </label>
              <label>
                {t("holdings.buyPrice")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={firstBuyForm.price}
                  onChange={(event) =>
                    setFirstBuyForm((prev) => ({ ...prev, price: event.target.value }))
                  }
                />
              </label>
              <label>
                {t("holdings.feeMode")}
                <select
                  value={firstBuyForm.feeMode}
                  onChange={(event) =>
                    setFirstBuyForm((prev) => ({
                      ...prev,
                      feeMode: event.target.value as TransactionFeeMode
                    }))
                  }
                >
                  <option value="manual">{t("holdings.feeMode.manual")}</option>
                  <option value="auto_hsbc_trade25">{t("holdings.feeMode.autoTrade25")}</option>
                </select>
              </label>
              <label>
                {t("holdings.fee")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={firstBuyForm.feeMode === "manual" ? firstBuyForm.fee : String(firstBuyAutoFeePreview)}
                  disabled={firstBuyForm.feeMode !== "manual"}
                  onChange={(event) =>
                    setFirstBuyForm((prev) => ({ ...prev, fee: event.target.value }))
                  }
                />
              </label>
              <label>
                {t("holdings.tradeDateOptional")}
                <input
                  type="date"
                  value={firstBuyForm.tradeDate}
                  onChange={(event) =>
                    setFirstBuyForm((prev) => ({ ...prev, tradeDate: event.target.value }))
                  }
                />
              </label>
              <label className="full-width">
                {t("holdings.noteOptional")}
                <textarea
                  rows={2}
                  value={firstBuyForm.notes}
                  onChange={(event) =>
                    setFirstBuyForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </label>
            </div>
            {firstBuyForm.feeMode === "auto_hsbc_trade25" ? (
              <p className="muted">
                {t("holdings.feeMode.autoPreview", { value: formatCurrency(firstBuyAutoFeePreview) })}
              </p>
            ) : null}
            <div className="row-actions">
              <button type="submit" className="btn btn--primary">
                {t("holdings.savePurchased")}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="panel">
        <h3>{t("holdings.watchlistTitle")}</h3>
        <p className="muted">{t("holdings.watchlistDesc")}</p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("holdings.table.symbol")}</th>
                <th>{t("holdings.table.name")}</th>
                <th>{t("holdings.table.type")}</th>
                <th>{t("holdings.table.lastPrice")}</th>
                <th>{t("holdings.table.priceSource")}</th>
                <th>{t("holdings.table.note")}</th>
                <th>{t("holdings.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.watchlist.map((item) => (
                <tr key={item.id}>
                  <td>{item.symbol}</td>
                  <td>{item.nameZh ? `${item.nameEn} / ${item.nameZh}` : item.nameEn}</td>
                  <td>{item.assetType}</td>
                  <td>
                    {item.priceStatus === "cached" && item.currentPrice != null
                      ? formatCurrency(item.currentPrice, item.currency)
                      : "-"}
                  </td>
                  <td>
                    {item.priceStatus === "cached"
                      ? `${item.priceProvider ?? "cached"} (${formatDateTime(item.priceAsOf)})`
                      : t("holdings.noCachedQuote")}
                  </td>
                  <td>{item.notes || "-"}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() =>
                          openTransactionForm({
                            symbol: item.symbol,
                            type: "BUY",
                            priceHint: item.currentPrice
                          })
                        }
                      >
                        {t("holdings.addTransaction")}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => void handleDeleteWatchlist(item.id)}
                      >
                        {t("holdings.remove")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.watchlist.length === 0 ? (
          <p className="muted">{t("holdings.noWatchlist")}</p>
        ) : null}
      </section>

      <section className="panel">
        <h3>{t("holdings.purchasedTitle")}</h3>
        <p className="muted">{t("holdings.unrealized", { value: formatSignedCurrency(totals.unrealized) })}</p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("holdings.table.symbol")}</th>
                <th>{t("holdings.table.name")}</th>
                <th>{t("holdings.table.type")}</th>
                <th>{t("holdings.table.qty")}</th>
                <th>{t("holdings.table.avgCost")}</th>
                <th>{t("holdings.table.currentPrice")}</th>
                <th>{t("holdings.table.priceSource")}</th>
                <th>{t("holdings.table.marketValue")}</th>
                <th>{t("holdings.table.unrealized")}</th>
                <th>{t("holdings.table.returnPct")}</th>
                <th>{t("holdings.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.holdings.map((holding) => (
                <tr key={holding.id}>
                  <td>{holding.symbol}</td>
                  <td>{holding.name}</td>
                  <td>{holding.assetType}</td>
                  <td>{holding.quantity}</td>
                  <td>{formatCurrency(holding.averageCost, holding.currency)}</td>
                  <td>
                    {holding.priceStatus === "cached"
                      ? formatCurrency(holding.currentPrice, holding.currency)
                      : "-"}
                  </td>
                  <td>
                    {holding.priceStatus === "cached"
                      ? `${holding.priceProvider ?? "cached"} (${formatDateTime(holding.priceAsOf)})`
                      : t("holdings.noCachedQuote")}
                  </td>
                  <td>{formatCurrency(holding.marketValue, holding.currency)}</td>
                  <td className={`tone-${numberTone(holding.unrealizedPL)}`}>
                    {formatSignedCurrency(holding.unrealizedPL, holding.currency)}
                  </td>
                  <td className={`tone-${numberTone(holding.unrealizedReturnPct)}`}>
                    {formatPercent(holding.unrealizedReturnPct)}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() =>
                          openHoldingEditForm({
                            id: holding.id,
                            symbol: holding.symbol,
                            quantity: holding.quantity,
                            averageCost: holding.averageCost
                          })
                        }
                      >
                        {t("holdings.editHolding")}
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() =>
                          openTransactionForm({
                            symbol: holding.symbol,
                            type: "BUY",
                            priceHint: holding.currentPrice
                          })
                        }
                      >
                        {t("holdings.addTransaction")}
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => void handleDeleteHolding(holding.id)}
                      >
                        {t("holdings.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.holdings.length === 0 ? (
          <p className="muted">{t("holdings.noPurchased")}</p>
        ) : null}

        <div className="summary-list-wrap">
          <h4>{t("holdings.costSummary.title")}</h4>
          <ul className="summary-list">
            <li>
              <span>{t("holdings.costSummary.currentCostBasis")}</span>
              <strong>{formatCurrency(data.costSummary.currentCostBasis)}</strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.currentMarketValue")}</span>
              <strong>{formatCurrency(data.costSummary.currentMarketValue)}</strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.currentUnrealized")}</span>
              <strong className={`tone-${numberTone(data.costSummary.currentUnrealizedPL)}`}>
                {formatSignedCurrency(data.costSummary.currentUnrealizedPL)}
              </strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.totalBuy")}</span>
              <strong>{formatCurrency(data.costSummary.cumulativeBuyAmount)}</strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.totalSell")}</span>
              <strong>{formatCurrency(data.costSummary.cumulativeSellAmount)}</strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.totalDividends")}</span>
              <strong>{formatCurrency(data.costSummary.cumulativeDividends)}</strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.brokerageFees")}</span>
              <strong>{formatCurrency(data.costSummary.brokerageFees)}</strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.stampDuty")}</span>
              <strong>{formatCurrency(data.costSummary.stampDuty)}</strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.transactionLevy")}</span>
              <strong>{formatCurrency(data.costSummary.transactionLevy)}</strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.tradingFees")}</span>
              <strong>{formatCurrency(data.costSummary.tradingFees)}</strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.otherFees")}</span>
              <strong>{formatCurrency(data.costSummary.otherFees)}</strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.totalFees")}</span>
              <strong>{formatCurrency(data.costSummary.totalFees)}</strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.netInvested")}</span>
              <strong>{formatCurrency(data.costSummary.netInvested)}</strong>
            </li>
            <li>
              <span>{t("holdings.costSummary.totalReturn")}</span>
              <strong className={`tone-${numberTone(data.costSummary.totalReturn)}`}>
                {formatSignedCurrency(data.costSummary.totalReturn)}
              </strong>
            </li>
          </ul>
        </div>

        {editingHoldingId ? (
          <form className="data-form" onSubmit={(event) => void handleHoldingEditSubmit(event)}>
            <h4>{t("holdings.editHoldingFor", { symbol: editingHoldingSymbol })}</h4>
            <div className="form-grid">
              <label>
                {t("holdings.quantity")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={holdingEditForm.quantity}
                  onChange={(event) =>
                    setHoldingEditForm((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                />
              </label>
              <label>
                {t("holdings.averageCost")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={holdingEditForm.averageCost}
                  onChange={(event) =>
                    setHoldingEditForm((prev) => ({ ...prev, averageCost: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="row-actions">
              <button type="submit" className="btn btn--primary">
                {t("holdings.updateHolding")}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={resetHoldingEditForm}
              >
                {t("holdings.cancelEdit")}
              </button>
            </div>
          </form>
        ) : null}

        {transactionForm.symbol ? (
          <form className="data-form" onSubmit={(event) => void handleTransactionSubmit(event)}>
            <h4>{t("holdings.addTransactionFor", { symbol: transactionForm.symbol })}</h4>
            <div className="form-grid">
              <label>
                {t("holdings.transactionType")}
                <select
                  value={transactionForm.transactionType}
                  onChange={(event) =>
                    setTransactionForm((prev) => ({
                      ...prev,
                      transactionType: event.target.value as TransactionType
                    }))
                  }
                >
                  <option value="BUY">{t("holdings.transaction.buy")}</option>
                  <option value="SELL">{t("holdings.transaction.sell")}</option>
                </select>
              </label>
              <label>
                {t("holdings.feeMode")}
                <select
                  value={transactionForm.feeMode}
                  onChange={(event) =>
                    setTransactionForm((prev) => ({
                      ...prev,
                      feeMode: event.target.value as TransactionFeeMode
                    }))
                  }
                >
                  <option value="manual">{t("holdings.feeMode.manual")}</option>
                  <option value="auto_hsbc_trade25">{t("holdings.feeMode.autoTrade25")}</option>
                </select>
              </label>
              <label>
                {t("holdings.quantity")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={transactionForm.quantity}
                  onChange={(event) =>
                    setTransactionForm((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                />
              </label>
              <label>
                {t("holdings.price")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={transactionForm.price}
                  onChange={(event) =>
                    setTransactionForm((prev) => ({ ...prev, price: event.target.value }))
                  }
                />
              </label>
              <label>
                {t("holdings.fee")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={transactionForm.feeMode === "manual" ? transactionForm.fee : String(autoFeePreview)}
                  disabled={transactionForm.feeMode !== "manual"}
                  onChange={(event) =>
                    setTransactionForm((prev) => ({ ...prev, fee: event.target.value }))
                  }
                />
              </label>
              <label>
                {t("holdings.tradeDateOptional")}
                <input
                  type="date"
                  value={transactionForm.tradeDate}
                  onChange={(event) =>
                    setTransactionForm((prev) => ({ ...prev, tradeDate: event.target.value }))
                  }
                />
              </label>
              <label className="full-width">
                {t("holdings.notes")}
                <textarea
                  rows={2}
                  value={transactionForm.notes}
                  onChange={(event) =>
                    setTransactionForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </label>
            </div>
            {transactionForm.feeMode === "auto_hsbc_trade25" ? (
              <p className="muted">
                {t("holdings.feeMode.autoPreview", { value: formatCurrency(autoFeePreview) })}
              </p>
            ) : null}
            <div className="row-actions">
              <button type="submit" className="btn btn--primary">
                {t("holdings.saveTransaction")}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setTransactionForm(defaultTransactionForm)}
              >
                {t("holdings.cancel")}
              </button>
            </div>
          </form>
        ) : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("holdings.table.date")}</th>
                <th>{t("holdings.table.symbol")}</th>
                <th>{t("holdings.table.type")}</th>
                <th>{t("holdings.table.quantity")}</th>
                <th>{t("holdings.table.price")}</th>
                <th>{t("holdings.table.feeMode")}</th>
                <th>{t("holdings.table.brokerageFee")}</th>
                <th>{t("holdings.table.stampDuty")}</th>
                <th>{t("holdings.table.transactionLevy")}</th>
                <th>{t("holdings.table.tradingFee")}</th>
                <th>{t("holdings.table.fee")}</th>
                <th>{t("holdings.table.notes")}</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.slice(0, 12).map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.tradeDate}</td>
                  <td>{transaction.symbol}</td>
                  <td>{transactionTypeLabel(transaction.transactionType)}</td>
                  <td>{transaction.quantity}</td>
                  <td>{formatCurrency(transaction.price)}</td>
                  <td>{transactionFeeModeLabel(transaction.feeMode)}</td>
                  <td>{formatCurrency(transaction.brokerageFee)}</td>
                  <td>{formatCurrency(transaction.stampDuty)}</td>
                  <td>{formatCurrency(transaction.transactionLevy)}</td>
                  <td>{formatCurrency(transaction.tradingFee)}</td>
                  <td>{formatCurrency(transaction.fee)}</td>
                  <td>{transaction.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.transactions.length === 0 ? (
          <p className="muted">{t("holdings.noTransactions")}</p>
        ) : null}
      </section>

      <section className="panel">
        <h3>{t("holdings.manualTitle")}</h3>
        <p className="muted">{t("holdings.manualDesc")}</p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("holdings.table.code")}</th>
                <th>{t("holdings.table.name")}</th>
                <th>{t("holdings.table.type")}</th>
                <th>{t("holdings.table.qty")}</th>
                <th>{t("holdings.table.avgCost")}</th>
                <th>{t("holdings.table.manualPrice")}</th>
                <th>{t("holdings.table.priceSource")}</th>
                <th>{t("holdings.table.marketValue")}</th>
                <th>{t("holdings.table.unrealized")}</th>
                <th>{t("holdings.table.returnPct")}</th>
                <th>{t("holdings.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.manualAssets.map((asset) => (
                <tr key={asset.id}>
                  <td>{asset.code}</td>
                  <td>{asset.name}</td>
                  <td>{asset.assetType}</td>
                  <td>{asset.quantity}</td>
                  <td>{formatCurrency(asset.averageCost, asset.currency)}</td>
                  <td>{formatCurrency(asset.currentPrice, asset.currency)}</td>
                  <td>{`${asset.priceProvider} (${formatDateTime(asset.priceAsOf)})`}</td>
                  <td>{formatCurrency(asset.marketValue, asset.currency)}</td>
                  <td className={`tone-${numberTone(asset.unrealizedPL)}`}>
                    {formatSignedCurrency(asset.unrealizedPL, asset.currency)}
                  </td>
                  <td className={`tone-${numberTone(asset.unrealizedReturnPct)}`}>
                    {formatPercent(asset.unrealizedReturnPct)}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => {
                          setEditingManualId(asset.id);
                          setManualForm({
                            code: asset.code,
                            name: asset.name,
                            assetType: asset.assetType,
                            quantity: String(asset.quantity),
                            averageCost: String(asset.averageCost),
                            manualPrice: String(asset.manualPrice),
                            currency: asset.currency,
                            region: asset.region,
                            strategyLabel: asset.strategyLabel,
                            riskGroup: asset.riskGroup,
                            tags: toTagInput(asset.tags),
                            notes: asset.notes
                          });
                        }}
                      >
                        {t("dividends.action.edit")}
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => void handleDeleteManualAsset(asset.id)}
                      >
                        {t("holdings.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.manualAssets.length === 0 ? (
          <p className="muted">{t("holdings.noManual")}</p>
        ) : null}

        <form className="data-form" onSubmit={(event) => void handleManualSubmit(event)}>
          <h4>{editingManualId ? t("holdings.editManual") : t("holdings.addManual")}</h4>
          <div className="form-grid">
            <label>
              {t("holdings.table.code")}
              <input
                value={manualForm.code}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
                }
                required
              />
            </label>
            <label>
              {t("holdings.assetName")}
              <input
                value={manualForm.name}
                onChange={(event) => setManualForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
            <label>
              {t("holdings.assetType")}
              <input
                value={manualForm.assetType}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, assetType: event.target.value }))
                }
                required
              />
            </label>
            <label>
              {t("holdings.quantity")}
              <input
                type="number"
                min="0"
                step="any"
                value={manualForm.quantity}
                onChange={(event) => setManualForm((prev) => ({ ...prev, quantity: event.target.value }))}
                required
              />
            </label>
            <label>
              {t("holdings.averageCost")}
              <input
                type="number"
                min="0"
                step="any"
                value={manualForm.averageCost}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, averageCost: event.target.value }))
                }
                required
              />
            </label>
            <label>
              {t("holdings.manualPrice")}
              <input
                type="number"
                min="0"
                step="any"
                value={manualForm.manualPrice}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, manualPrice: event.target.value }))
                }
                required
              />
            </label>
            <label>
              {t("holdings.currency")}
              <input
                value={manualForm.currency}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                }
                required
              />
            </label>
            <label>
              {t("holdings.region")}
              <input
                value={manualForm.region}
                onChange={(event) => setManualForm((prev) => ({ ...prev, region: event.target.value }))}
              />
            </label>
            <label>
              {t("holdings.strategyLabel")}
              <input
                value={manualForm.strategyLabel}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, strategyLabel: event.target.value }))
                }
              />
            </label>
            <label>
              {t("holdings.riskGroup")}
              <select
                value={manualForm.riskGroup}
                onChange={(event) => setManualForm((prev) => ({ ...prev, riskGroup: event.target.value }))}
              >
                <option value="growth">{t("holdings.risk.growth")}</option>
                <option value="defensive">{t("holdings.risk.defensive")}</option>
                <option value="income">{t("holdings.risk.income")}</option>
              </select>
            </label>
            <label>
              {t("holdings.tags")}
              <input
                value={manualForm.tags}
                onChange={(event) => setManualForm((prev) => ({ ...prev, tags: event.target.value }))}
              />
            </label>
            <label className="full-width">
              {t("holdings.notes")}
              <textarea
                rows={2}
                value={manualForm.notes}
                onChange={(event) => setManualForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn--primary">
              {editingManualId ? t("holdings.updateManual") : t("holdings.addManual")}
            </button>
            {editingManualId ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setEditingManualId(null);
                  setManualForm(defaultManualAssetForm);
                }}
              >
                {t("holdings.cancelEdit")}
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </section>
  );
}
