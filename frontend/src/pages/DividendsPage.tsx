import { useCallback, useEffect, useMemo, useState } from "react";
import type { DividendsResponse } from "@portfolio/shared";
import { api } from "../api/client";
import { useI18n } from "../i18n/provider";
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
  const { t } = useI18n();
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
      setError(loadError instanceof Error ? loadError.message : t("common.notAvailable"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
      setFormError(t("dividends.error.requiredFields"));
      return;
    }

    if (!Number.isFinite(dividendPerUnit) || dividendPerUnit < 0) {
      setFormError(t("dividends.error.perUnitInvalid"));
      return;
    }

    if (!Number.isFinite(receivedAmount) || receivedAmount < 0) {
      setFormError(t("dividends.error.receivedInvalid"));
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
      setFormError(submitError instanceof Error ? submitError.message : t("dividends.error.save"));
    }
  }

  async function handleDelete(id: number): Promise<void> {
    if (!window.confirm(t("dividends.deleteConfirm"))) {
      return;
    }
    try {
      await api.deleteDividend(id);
      await loadData();
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : t("dividends.error.delete"));
    }
  }

  if (loading) {
    return <p>{t("common.loadingDividends")}</p>;
  }

  if (error || !data) {
    return <p className="error">{error ?? t("common.notAvailable")}</p>;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <h2>{t("dividends.title")}</h2>
        <p className="muted">{t("dividends.subtitle")}</p>
      </div>

      <section className="stats-grid stats-grid--compact">
        <article className="stat-card">
          <p className="stat-card__label">{t("dividends.stat.totalCash")}</p>
          <p className="stat-card__value">{formatCurrency(data.summary.totalReceived)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-card__label">{t("dividends.stat.records")}</p>
          <p className="stat-card__value">{data.records.length}</p>
        </article>
      </section>

      <section className="panel">
        <h3>{t("dividends.byAsset")}</h3>
        {topAssets.length === 0 ? (
          <p className="muted">{t("dividends.empty")}</p>
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
        <h3>{t("dividends.history")}</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t("dividends.form.symbol")}</th>
                <th>{t("dividends.form.exDate")}</th>
                <th>{t("dividends.form.paymentDate")}</th>
                <th>{t("dividends.form.perUnit")}</th>
                <th>{t("dividends.form.received")}</th>
                <th>{t("dividends.table.currency")}</th>
                <th>{t("dividends.form.notes")}</th>
                <th>{t("dividends.table.actions")}</th>
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
                        {t("dividends.action.edit")}
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => void handleDelete(record.id)}
                      >
                        {t("dividends.action.delete")}
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
        <h3>{editingId ? t("dividends.form.editTitle") : t("dividends.form.addTitle")}</h3>
        {formError ? <p className="error">{formError}</p> : null}
        <form className="data-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-grid">
            <label>
              {t("dividends.form.symbol")}
              <input
                value={form.symbol}
                onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))}
                required
              />
            </label>
            <label>
              {t("dividends.form.exDate")}
              <input
                type="date"
                value={form.exDividendDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, exDividendDate: event.target.value }))
                }
              />
            </label>
            <label>
              {t("dividends.form.paymentDate")}
              <input
                type="date"
                value={form.paymentDate}
                onChange={(event) => setForm((prev) => ({ ...prev, paymentDate: event.target.value }))}
                required
              />
            </label>
            <label>
              {t("dividends.form.perUnit")}
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
              {t("dividends.form.received")}
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
              {t("dividends.form.currency")}
              <input
                value={form.currency}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                }
                required
              />
            </label>
            <label className="full-width">
              {t("dividends.form.notes")}
              <textarea
                rows={2}
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </label>
          </div>

          <div className="row-actions">
            <button type="submit" className="btn btn--primary">
              {editingId ? t("dividends.form.update") : t("dividends.form.add")}
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
                {t("dividends.form.cancel")}
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </section>
  );
}
