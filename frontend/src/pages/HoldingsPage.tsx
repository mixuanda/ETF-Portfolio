import { useCallback, useEffect, useMemo, useState } from "react";
import type { HoldingsResponse, RefreshStatus } from "@portfolio/shared";
import { api } from "../api/client";
import { RefreshPanel } from "../components/RefreshPanel";
import { useRefreshPrices } from "../hooks/useRefreshPrices";
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
  numberTone
} from "../utils/format";

interface HoldingFormState {
  symbol: string;
  name: string;
  assetType: string;
  quantity: string;
  averageCost: string;
  currency: string;
  region: string;
  strategyLabel: string;
  riskGroup: string;
  tags: string;
  notes: string;
}

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

const defaultHoldingForm: HoldingFormState = {
  symbol: "",
  name: "",
  assetType: "equity etf",
  quantity: "",
  averageCost: "",
  currency: "HKD",
  region: "Hong Kong",
  strategyLabel: "core",
  riskGroup: "growth",
  tags: "equity",
  notes: ""
};

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

function toTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index);
}

function toTagInput(tags: string[]): string {
  return tags.join(", ");
}

export function HoldingsPage(): JSX.Element {
  const [data, setData] = useState<HoldingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [holdingForm, setHoldingForm] = useState<HoldingFormState>(defaultHoldingForm);
  const [manualForm, setManualForm] = useState<ManualAssetFormState>(defaultManualAssetForm);
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null);
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

  const { refreshStatus, refreshMessage, isRefreshing, triggerRefresh } = useRefreshPrices(loadData);

  const effectiveStatus: RefreshStatus =
    refreshStatus === "idle" && data ? data.refreshStatus : refreshStatus;

  const displayedRefreshMessage =
    refreshStatus === "idle"
      ? "Holdings loaded from cached snapshot. Click Refresh Prices for delayed quote updates."
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

  async function handleHoldingSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const quantity = Number(holdingForm.quantity);
    const averageCost = Number(holdingForm.averageCost);

    if (!holdingForm.symbol.trim() || !holdingForm.name.trim()) {
      setFormError("Symbol and asset name are required.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(averageCost) || averageCost < 0) {
      setFormError("Quantity and average cost must be valid non-negative numbers.");
      return;
    }

    const payload = {
      symbol: holdingForm.symbol.trim().toUpperCase(),
      name: holdingForm.name.trim(),
      assetType: holdingForm.assetType.trim(),
      quantity,
      averageCost,
      currency: holdingForm.currency.trim().toUpperCase(),
      region: holdingForm.region.trim(),
      strategyLabel: holdingForm.strategyLabel.trim(),
      riskGroup: holdingForm.riskGroup.trim(),
      tags: toTags(holdingForm.tags),
      notes: holdingForm.notes.trim()
    };

    try {
      if (editingHoldingId) {
        await api.updateHolding(editingHoldingId, payload);
      } else {
        await api.createHolding(payload);
      }
      setHoldingForm(defaultHoldingForm);
      setEditingHoldingId(null);
      await loadData();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Unable to save holding");
    }
  }

  async function handleDeleteHolding(id: number): Promise<void> {
    if (!window.confirm("Delete this holding?")) {
      return;
    }
    try {
      await api.deleteHolding(id);
      await loadData();
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : "Unable to delete holding");
    }
  }

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

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
      } else {
        await api.createManualAsset(payload);
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
          Manage ETF positions and manually tracked products. Current total value {formatCurrency(totals.marketValue)}.
        </p>
      </div>

      <RefreshPanel
        status={effectiveStatus}
        message={displayedRefreshMessage}
        lastRefreshAt={data.lastRefreshAt}
        onRefresh={triggerRefresh}
        disabled={isRefreshing}
      />

      {formError ? <p className="error">{formError}</p> : null}

      <section className="panel">
        <h3>ETF Holdings</h3>
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
                  <td>{formatCurrency(holding.currentPrice, holding.currency)}</td>
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
                        onClick={() => {
                          setEditingHoldingId(holding.id);
                          setHoldingForm({
                            symbol: holding.symbol,
                            name: holding.name,
                            assetType: holding.assetType,
                            quantity: String(holding.quantity),
                            averageCost: String(holding.averageCost),
                            currency: holding.currency,
                            region: holding.region,
                            strategyLabel: holding.strategyLabel,
                            riskGroup: holding.riskGroup,
                            tags: toTagInput(holding.tags),
                            notes: holding.notes
                          });
                        }}
                      >
                        Edit
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

        <form className="data-form" onSubmit={(event) => void handleHoldingSubmit(event)}>
          <h4>{editingHoldingId ? "Edit holding" : "Add holding"}</h4>
          <div className="form-grid">
            <label>
              Symbol / Code
              <input
                value={holdingForm.symbol}
                onChange={(event) =>
                  setHoldingForm((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))
                }
                required
              />
            </label>
            <label>
              Asset Name
              <input
                value={holdingForm.name}
                onChange={(event) => setHoldingForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
            <label>
              Asset Type
              <input
                value={holdingForm.assetType}
                onChange={(event) =>
                  setHoldingForm((prev) => ({ ...prev, assetType: event.target.value }))
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
                value={holdingForm.quantity}
                onChange={(event) => setHoldingForm((prev) => ({ ...prev, quantity: event.target.value }))}
                required
              />
            </label>
            <label>
              Average Cost
              <input
                type="number"
                min="0"
                step="any"
                value={holdingForm.averageCost}
                onChange={(event) =>
                  setHoldingForm((prev) => ({ ...prev, averageCost: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Currency
              <input
                value={holdingForm.currency}
                onChange={(event) =>
                  setHoldingForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                }
                required
              />
            </label>
            <label>
              Region
              <input
                value={holdingForm.region}
                onChange={(event) => setHoldingForm((prev) => ({ ...prev, region: event.target.value }))}
              />
            </label>
            <label>
              Strategy Label
              <input
                value={holdingForm.strategyLabel}
                onChange={(event) =>
                  setHoldingForm((prev) => ({ ...prev, strategyLabel: event.target.value }))
                }
              />
            </label>
            <label>
              Risk Group
              <select
                value={holdingForm.riskGroup}
                onChange={(event) =>
                  setHoldingForm((prev) => ({ ...prev, riskGroup: event.target.value }))
                }
              >
                <option value="growth">growth</option>
                <option value="defensive">defensive</option>
                <option value="income">income</option>
              </select>
            </label>
            <label>
              Tags (comma separated)
              <input
                value={holdingForm.tags}
                onChange={(event) => setHoldingForm((prev) => ({ ...prev, tags: event.target.value }))}
              />
            </label>
            <label className="full-width">
              Notes
              <textarea
                rows={2}
                value={holdingForm.notes}
                onChange={(event) => setHoldingForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn--primary">
              {editingHoldingId ? "Update Holding" : "Add Holding"}
            </button>
            {editingHoldingId ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setEditingHoldingId(null);
                  setHoldingForm(defaultHoldingForm);
                }}
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
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
