import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  HoldingsResponse,
  InstrumentSearchResult,
  RefreshStatus,
  TransactionType
} from "@portfolio/shared";
import { api } from "../api/client";
import { RefreshPanel } from "../components/RefreshPanel";
import { useRefreshPrices } from "../hooks/useRefreshPrices";
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
  tradeDate: string;
  notes: string;
}

interface TransactionFormState {
  symbol: string;
  transactionType: TransactionType;
  quantity: string;
  price: string;
  fee: string;
  tradeDate: string;
  notes: string;
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
  tradeDate: "",
  notes: ""
};

const defaultTransactionForm: TransactionFormState = {
  symbol: "",
  transactionType: "BUY",
  quantity: "",
  price: "",
  fee: "0",
  tradeDate: "",
  notes: ""
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

export function HoldingsPage(): JSX.Element {
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

  const [manualForm, setManualForm] = useState<ManualAssetFormState>(defaultManualAssetForm);
  const [editingManualId, setEditingManualId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.getHoldings();
      setData(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load holdings");
    } finally {
      setLoading(false);
    }
  }, []);

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
        ? data?.lastRefreshError ?? "Latest refresh failed. Showing previous cached snapshot data."
        : "Holdings loaded from cached snapshot. Click Refresh Prices for delayed quote updates."
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
      setSuccessMessage(`${selectedInstrument.symbol} is now tracked in watchlist.`);
      clearSelection();
      setSearchQuery("");
      setSearchResults([]);
      await loadData();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Unable to add to watchlist");
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

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError("Quantity must be greater than zero.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError("Buy price must be a valid non-negative number.");
      return;
    }

    try {
      await api.createTransaction({
        symbol: selectedInstrument.symbol,
        transactionType: "BUY",
        quantity,
        price,
        fee: 0,
        tradeDate: firstBuyForm.tradeDate || null,
        notes: firstBuyForm.notes.trim()
      });

      setSuccessMessage(`Added BUY transaction for ${selectedInstrument.symbol}.`);
      clearSelection();
      setSearchQuery("");
      setSearchResults([]);
      await loadData();
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : "Unable to create transaction"
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
      quantity: "",
      price: input.priceHint != null ? String(input.priceHint) : "",
      fee: "0",
      tradeDate: "",
      notes: ""
    });
    setFormError(null);
    setSuccessMessage(null);
  }

  async function handleTransactionSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const quantity = Number(transactionForm.quantity);
    const price = Number(transactionForm.price);
    const fee = Number(transactionForm.fee || "0");

    if (!transactionForm.symbol) {
      setFormError("Please choose a symbol first.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setFormError("Quantity must be greater than zero.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setFormError("Price must be a valid non-negative number.");
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      setFormError("Fee must be a valid non-negative number.");
      return;
    }

    try {
      await api.createTransaction({
        symbol: transactionForm.symbol,
        transactionType: transactionForm.transactionType,
        quantity,
        price,
        fee,
        tradeDate: transactionForm.tradeDate || null,
        notes: transactionForm.notes.trim()
      });

      setSuccessMessage(
        `Added ${transactionForm.transactionType} transaction for ${transactionForm.symbol}.`
      );
      setTransactionForm(defaultTransactionForm);
      await loadData();
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : "Unable to create transaction"
      );
    }
  }

  async function handleDeleteHolding(id: number): Promise<void> {
    if (!window.confirm("Delete this purchased holding summary?")) {
      return;
    }
    try {
      setFormError(null);
      setSuccessMessage(null);
      await api.deleteHolding(id);
      await loadData();
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : "Unable to delete holding");
    }
  }

  async function handleDeleteWatchlist(id: number): Promise<void> {
    if (!window.confirm("Remove this symbol from watchlist?")) {
      return;
    }

    try {
      setFormError(null);
      setSuccessMessage(null);
      await api.deleteWatchlistItem(id);
      await loadData();
    } catch (deleteError) {
      setFormError(
        deleteError instanceof Error ? deleteError.message : "Unable to remove watchlist item"
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
      setFormError("Manual asset code and name are required.");
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
      setFormError("Quantity, average cost, and manual price must be valid non-negative numbers.");
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
        setSuccessMessage("Manual product updated.");
      } else {
        await api.createManualAsset(payload);
        setSuccessMessage("Manual product added.");
      }
      setManualForm(defaultManualAssetForm);
      setEditingManualId(null);
      await loadData();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Unable to save manual asset");
    }
  }

  async function handleDeleteManualAsset(id: number): Promise<void> {
    if (!window.confirm("Delete this manual asset?")) {
      return;
    }

    try {
      setFormError(null);
      setSuccessMessage(null);
      await api.deleteManualAsset(id);
      await loadData();
    } catch (deleteError) {
      setFormError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete manual asset"
      );
    }
  }

  if (loading) {
    return <p>Loading holdings...</p>;
  }

  if (error || !data) {
    return <p className="error">{error ?? "Holdings data unavailable"}</p>;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <h2>Holdings</h2>
        <p className="muted">
          Search-first workflow for HK ETFs with transaction-ready tracking. Current purchased value{" "}
          {formatCurrency(totals.marketValue)}.
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
        <h3>Search and Add</h3>
        <p className="muted">
          Step 1: search by symbol or English/Chinese name. Step 2: choose bought or not bought.
        </p>

        <label>
          Search HK ETF
          <input
            value={searchQuery}
            placeholder="Try 03010, 02100, Hang Seng, 恒生"
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

        {searchLoading ? <p className="muted">Searching instruments...</p> : null}

        {searchOpen && searchQuery.trim() ? (
          <div className="search-results-wrap">
            {searchResults.length === 0 ? (
              <p className="muted">No instrument matches. Try a shorter keyword.</p>
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
              {selectedInstrument.assetType} · {selectedInstrument.issuer || "Issuer N/A"} ·{" "}
              {selectedInstrument.currency} · {selectedInstrument.region}
            </p>

            <div className="row-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setPurchaseDecision("yes")}
              >
                Yes, already bought
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setPurchaseDecision("no")}
              >
                No, track only
              </button>
              <button type="button" className="btn btn--ghost" onClick={clearSelection}>
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {selectedInstrument && purchaseDecision === "no" ? (
          <form className="data-form" onSubmit={(event) => void handleAddToWatchlist(event)}>
            <h4>Add to watchlist</h4>
            <label>
              Optional note
              <input
                value={watchlistNote}
                onChange={(event) => setWatchlistNote(event.target.value)}
                placeholder="e.g. waiting for pullback"
              />
            </label>
            <div className="row-actions">
              <button type="submit" className="btn btn--primary">
                Save as tracked only
              </button>
            </div>
          </form>
        ) : null}

        {selectedInstrument && purchaseDecision === "yes" ? (
          <form className="data-form" onSubmit={(event) => void handleFirstBuySubmit(event)}>
            <h4>Record first BUY</h4>
            <div className="form-grid">
              <label>
                Quantity
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
                Buy Price
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
                Trade Date (optional)
                <input
                  type="date"
                  value={firstBuyForm.tradeDate}
                  onChange={(event) =>
                    setFirstBuyForm((prev) => ({ ...prev, tradeDate: event.target.value }))
                  }
                />
              </label>
              <label className="full-width">
                Note (optional)
                <textarea
                  rows={2}
                  value={firstBuyForm.notes}
                  onChange={(event) =>
                    setFirstBuyForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="row-actions">
              <button type="submit" className="btn btn--primary">
                Save purchased holding
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="panel">
        <h3>Watchlist / Tracked Instruments</h3>
        <p className="muted">Tracked ETFs with no purchased quantity yet.</p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Type</th>
                <th>Last Price</th>
                <th>Price Source</th>
                <th>Note</th>
                <th>Actions</th>
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
                      : "No cached quote"}
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
                        Add transaction
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => void handleDeleteWatchlist(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.watchlist.length === 0 ? (
          <p className="muted">No tracked-only ETFs yet. Use search above to add one.</p>
        ) : null}
      </section>

      <section className="panel">
        <h3>Purchased Holdings</h3>
        <p className="muted">Unrealized P/L: {formatSignedCurrency(totals.unrealized)}</p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Avg Cost</th>
                <th>Current Price</th>
                <th>Price Source</th>
                <th>Market Value</th>
                <th>Unrealized P/L</th>
                <th>Return %</th>
                <th>Actions</th>
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
                      : "No cached quote"}
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
                        className="btn btn--primary"
                        onClick={() =>
                          openTransactionForm({
                            symbol: holding.symbol,
                            type: "BUY",
                            priceHint: holding.currentPrice
                          })
                        }
                      >
                        Add transaction
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => void handleDeleteHolding(holding.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.holdings.length === 0 ? (
          <p className="muted">No purchased holdings yet. Record a BUY transaction to start.</p>
        ) : null}

        {transactionForm.symbol ? (
          <form className="data-form" onSubmit={(event) => void handleTransactionSubmit(event)}>
            <h4>Add transaction for {transactionForm.symbol}</h4>
            <div className="form-grid">
              <label>
                Transaction Type
                <select
                  value={transactionForm.transactionType}
                  onChange={(event) =>
                    setTransactionForm((prev) => ({
                      ...prev,
                      transactionType: event.target.value as TransactionType
                    }))
                  }
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </label>
              <label>
                Quantity
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
                Price
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
                Fee
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={transactionForm.fee}
                  onChange={(event) =>
                    setTransactionForm((prev) => ({ ...prev, fee: event.target.value }))
                  }
                />
              </label>
              <label>
                Trade Date (optional)
                <input
                  type="date"
                  value={transactionForm.tradeDate}
                  onChange={(event) =>
                    setTransactionForm((prev) => ({ ...prev, tradeDate: event.target.value }))
                  }
                />
              </label>
              <label className="full-width">
                Notes
                <textarea
                  rows={2}
                  value={transactionForm.notes}
                  onChange={(event) =>
                    setTransactionForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </label>
            </div>
            <div className="row-actions">
              <button type="submit" className="btn btn--primary">
                Save Transaction
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setTransactionForm(defaultTransactionForm)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Fee</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.slice(0, 12).map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.tradeDate}</td>
                  <td>{transaction.symbol}</td>
                  <td>{transaction.transactionType}</td>
                  <td>{transaction.quantity}</td>
                  <td>{formatCurrency(transaction.price)}</td>
                  <td>{formatCurrency(transaction.fee)}</td>
                  <td>{transaction.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.transactions.length === 0 ? (
          <p className="muted">No transactions recorded yet.</p>
        ) : null}
      </section>

      <section className="panel">
        <h3>Manual Tracked Products</h3>
        <p className="muted">Use this section for products where price/NAV is entered manually.</p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Avg Cost</th>
                <th>Manual Price/NAV</th>
                <th>Price Source</th>
                <th>Market Value</th>
                <th>Unrealized P/L</th>
                <th>Return %</th>
                <th>Actions</th>
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
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => void handleDeleteManualAsset(asset.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.manualAssets.length === 0 ? (
          <p className="muted">No manual products yet. Add one below if needed.</p>
        ) : null}

        <form className="data-form" onSubmit={(event) => void handleManualSubmit(event)}>
          <h4>{editingManualId ? "Edit manual product" : "Add manual product"}</h4>
          <div className="form-grid">
            <label>
              Code
              <input
                value={manualForm.code}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
                }
                required
              />
            </label>
            <label>
              Asset Name
              <input
                value={manualForm.name}
                onChange={(event) => setManualForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
            <label>
              Asset Type
              <input
                value={manualForm.assetType}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, assetType: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Quantity
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
              Average Cost
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
              Manual Price / NAV
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
              Currency
              <input
                value={manualForm.currency}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                }
                required
              />
            </label>
            <label>
              Region
              <input
                value={manualForm.region}
                onChange={(event) => setManualForm((prev) => ({ ...prev, region: event.target.value }))}
              />
            </label>
            <label>
              Strategy Label
              <input
                value={manualForm.strategyLabel}
                onChange={(event) =>
                  setManualForm((prev) => ({ ...prev, strategyLabel: event.target.value }))
                }
              />
            </label>
            <label>
              Risk Group
              <select
                value={manualForm.riskGroup}
                onChange={(event) => setManualForm((prev) => ({ ...prev, riskGroup: event.target.value }))}
              >
                <option value="growth">growth</option>
                <option value="defensive">defensive</option>
                <option value="income">income</option>
              </select>
            </label>
            <label>
              Tags (comma separated)
              <input
                value={manualForm.tags}
                onChange={(event) => setManualForm((prev) => ({ ...prev, tags: event.target.value }))}
              />
            </label>
            <label className="full-width">
              Notes
              <textarea
                rows={2}
                value={manualForm.notes}
                onChange={(event) => setManualForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn--primary">
              {editingManualId ? "Update Manual Product" : "Add Manual Product"}
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
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </section>
  );
}
