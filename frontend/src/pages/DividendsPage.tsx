import { useCallback, useEffect, useMemo, useState } from "react";
import type { DividendsResponse } from "@portfolio/shared";
import { api } from "../api/client";
import { formatCurrency } from "../utils/format";

interface DividendFormState {
  symbol: string;
  exDividendDate: string;
  paymentDate: string;
  dividendPerUnit: string;
  receivedAmount: string;
  currency: string;
  notes: string;
}

const defaultForm: DividendFormState = {
  symbol: "",
  exDividendDate: "",
  paymentDate: "",
  dividendPerUnit: "",
  receivedAmount: "",
  currency: "HKD",
  notes: ""
};

export function DividendsPage(): JSX.Element {
  const [data, setData] = useState<DividendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<DividendFormState>(defaultForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.getDividends();
      setData(response);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dividends");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const topAssets = useMemo(() => data?.summary.byAsset.slice(0, 5) ?? [], [data]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const dividendPerUnit = Number(form.dividendPerUnit);
    const receivedAmount = Number(form.receivedAmount);

    if (!form.symbol.trim() || !form.paymentDate.trim()) {
      setFormError("Symbol and payment date are required.");
      return;
    }

    if (!Number.isFinite(dividendPerUnit) || dividendPerUnit < 0) {
      setFormError("Dividend per unit must be a valid non-negative number.");
      return;
    }

    if (!Number.isFinite(receivedAmount) || receivedAmount < 0) {
      setFormError("Received amount must be a valid non-negative number.");
      return;
    }

    const payload = {
      symbol: form.symbol.trim().toUpperCase(),
      exDividendDate: form.exDividendDate.trim() || null,
      paymentDate: form.paymentDate.trim(),
      dividendPerUnit,
      receivedAmount,
      currency: form.currency.trim().toUpperCase(),
      notes: form.notes.trim()
    };

    try {
      if (editingId) {
        await api.updateDividend(editingId, payload);
      } else {
        await api.createDividend(payload);
      }
      setForm(defaultForm);
      setEditingId(null);
      await loadData();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Unable to save dividend");
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (!window.confirm("Delete this dividend record?")) {
      return;
    }
    try {
      await api.deleteDividend(id);
      await loadData();
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : "Unable to delete dividend");
    }
  }

  if (loading) {
    return <p>Loading dividends...</p>;
  }

  if (error || !data) {
    return <p className="error">{error ?? "Dividends unavailable"}</p>;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <h2>Dividends</h2>
        <p className="muted">Track ex-dividend dates, payment dates, and received cash.</p>
      </div>

      <section className="stats-grid stats-grid--compact">
        <article className="stat-card">
          <p className="stat-card__label">Total Received Cash</p>
          <p className="stat-card__value">{formatCurrency(data.summary.totalReceived)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-card__label">Records</p>
          <p className="stat-card__value">{data.records.length}</p>
        </article>
      </section>

      <section className="panel">
        <h3>Total Dividends by Asset</h3>
        {topAssets.length === 0 ? (
          <p className="muted">No dividend records yet.</p>
        ) : (
          <ul className="summary-list">
            {topAssets.map((entry) => (
              <li key={entry.symbol}>
                <span>{entry.symbol}</span>
                <strong>{formatCurrency(entry.totalReceived)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h3>Dividend History</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Ex-Date</th>
                <th>Payment Date</th>
                <th>Dividend / Unit</th>
                <th>Received Amount</th>
                <th>Currency</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.records.map((record) => (
                <tr key={record.id}>
                  <td>{record.symbol}</td>
                  <td>{record.exDividendDate ?? "-"}</td>
                  <td>{record.paymentDate}</td>
                  <td>{formatCurrency(record.dividendPerUnit, record.currency)}</td>
                  <td>{formatCurrency(record.receivedAmount, record.currency)}</td>
                  <td>{record.currency}</td>
                  <td>{record.notes || "-"}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => {
                          setEditingId(record.id);
                          setForm({
                            symbol: record.symbol,
                            exDividendDate: record.exDividendDate ?? "",
                            paymentDate: record.paymentDate,
                            dividendPerUnit: String(record.dividendPerUnit),
                            receivedAmount: String(record.receivedAmount),
                            currency: record.currency,
                            notes: record.notes
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => void handleDelete(record.id)}
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
      </section>

      <section className="panel">
        <h3>{editingId ? "Edit Dividend Record" : "Add Dividend Record"}</h3>
        {formError ? <p className="error">{formError}</p> : null}
        <form className="data-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-grid">
            <label>
              Symbol
              <input
                value={form.symbol}
                onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))}
                required
              />
            </label>
            <label>
              Ex-Dividend Date
              <input
                type="date"
                value={form.exDividendDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, exDividendDate: event.target.value }))
                }
              />
            </label>
            <label>
              Payment Date
              <input
                type="date"
                value={form.paymentDate}
                onChange={(event) => setForm((prev) => ({ ...prev, paymentDate: event.target.value }))}
                required
              />
            </label>
            <label>
              Dividend per Unit
              <input
                type="number"
                min="0"
                step="any"
                value={form.dividendPerUnit}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, dividendPerUnit: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Received Amount
              <input
                type="number"
                min="0"
                step="any"
                value={form.receivedAmount}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, receivedAmount: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Currency
              <input
                value={form.currency}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                }
                required
              />
            </label>
            <label className="full-width">
              Notes
              <textarea
                rows={2}
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
          </div>

          <div className="row-actions">
            <button type="submit" className="btn btn--primary">
              {editingId ? "Update Record" : "Add Record"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(defaultForm);
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
