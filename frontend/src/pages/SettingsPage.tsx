import { useCallback, useEffect, useState } from "react";
import type { SettingsEnvelope } from "../api/client";
import { api } from "../api/client";
import { formatDateTime } from "../utils/format";

interface SettingsFormState {
  quoteProvider: "yahoo" | "demo";
  refreshTimeoutMs: string;
  refreshRetries: string;
  customTags: string;
  baseCurrency: string;
}

function mapEnvelopeToForm(envelope: SettingsEnvelope): SettingsFormState {
  return {
    quoteProvider: envelope.settings.quoteProvider,
    refreshTimeoutMs: String(envelope.settings.refreshTimeoutMs),
    refreshRetries: String(envelope.settings.refreshRetries),
    customTags: envelope.settings.customTags.join(", "),
    baseCurrency: envelope.settings.baseCurrency
  };
}

function splitTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index);
}

export function SettingsPage(): JSX.Element {
  const [data, setData] = useState<SettingsEnvelope | null>(null);
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.getSettings();
      setData(response);
      setForm(mapEnvelopeToForm(response));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!form) {
      return;
    }

    if (!data?.settings.enableDemoMode && form.quoteProvider === "demo") {
      setError("Demo mode is disabled by environment. Set ENABLE_DEMO_MODE=true to use demo quotes.");
      return;
    }

    const refreshTimeoutMs = Number(form.refreshTimeoutMs);
    const refreshRetries = Number(form.refreshRetries);

    if (!Number.isInteger(refreshTimeoutMs) || refreshTimeoutMs < 1000 || refreshTimeoutMs > 20000) {
      setError("Refresh timeout must be an integer between 1000 and 20000 ms.");
      return;
    }

    if (!Number.isInteger(refreshRetries) || refreshRetries < 0 || refreshRetries > 3) {
      setError("Refresh retries must be an integer between 0 and 3.");
      return;
    }

    try {
      setError(null);
      setNotice(null);
      await api.updateSettings({
        quoteProvider: form.quoteProvider,
        refreshTimeoutMs,
        refreshRetries,
        customTags: splitTags(form.customTags),
        baseCurrency: form.baseCurrency.trim().toUpperCase()
      });
      await loadData();
      setNotice("Settings updated.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update settings");
    }
  }

  if (loading) {
    return <p>Loading settings...</p>;
  }

  if (error && !data) {
    return <p className="error">{error}</p>;
  }

  if (!data || !form) {
    return <p className="error">Settings unavailable.</p>;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <h2>Settings / Data</h2>
        <p className="muted">Manage refresh behavior, quote provider, and custom classification tags.</p>
      </div>

      <section className="panel">
        <h3>Refresh Configuration</h3>
        <p className="muted">
          Last status: <strong>{data.settings.lastRefreshStatus}</strong> | Last refresh time: {" "}
          {formatDateTime(data.settings.lastRefreshAt)}
        </p>
        <p className="muted">
          Last successful source: {data.settings.lastRefreshProvider ?? "No successful refresh yet"}
        </p>
        <p className="muted">
          Demo mode: <strong>{data.settings.enableDemoMode ? "enabled" : "disabled"}</strong> | Demo
          fallback: <strong>{data.settings.allowDemoFallback ? "enabled" : "disabled"}</strong>
        </p>
        <p className="muted">
          HKEX backup source: <strong>{data.settings.enableHkexBackup ? "enabled" : "disabled"}</strong>
        </p>
        {data.settings.lastRefreshError ? (
          <p className="muted">Latest refresh message: {data.settings.lastRefreshError}</p>
        ) : null}

        <form className="data-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-grid">
            <label>
              Quote Provider
              <select
                value={form.quoteProvider}
                onChange={(event) =>
                  setForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          quoteProvider: event.target.value as "yahoo" | "demo"
                        }
                      : prev
                  )
                }
              >
                <option value="yahoo">Yahoo delayed quotes (normal mode)</option>
                <option value="demo" disabled={!data.settings.enableDemoMode}>
                  Demo deterministic quotes (explicit demo mode only)
                </option>
              </select>
            </label>
            <label>
              Request Timeout (ms)
              <input
                type="number"
                min="1000"
                max="20000"
                step="1"
                value={form.refreshTimeoutMs}
                onChange={(event) =>
                  setForm((prev) => (prev ? { ...prev, refreshTimeoutMs: event.target.value } : prev))
                }
              />
            </label>
            <label>
              Retry Count
              <input
                type="number"
                min="0"
                max="3"
                step="1"
                value={form.refreshRetries}
                onChange={(event) =>
                  setForm((prev) => (prev ? { ...prev, refreshRetries: event.target.value } : prev))
                }
              />
            </label>
            <label>
              Base Currency
              <input
                value={form.baseCurrency}
                onChange={(event) =>
                  setForm((prev) =>
                    prev ? { ...prev, baseCurrency: event.target.value.toUpperCase() } : prev
                  )
                }
              />
            </label>
            <label className="full-width">
              Custom Tags (comma separated)
              <input
                value={form.customTags}
                onChange={(event) =>
                  setForm((prev) => (prev ? { ...prev, customTags: event.target.value } : prev))
                }
              />
            </label>
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn--primary">
              Save Settings
            </button>
          </div>
          {notice ? <p className="success">{notice}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </form>
      </section>

      <section className="panel">
        <h3>Managed Symbols</h3>
        <p className="muted">
          Add/edit symbols in the Holdings page. Refresh uses this list for quote fetching.
        </p>
        {data.trackedSymbols.length === 0 ? (
          <p className="muted">No symbols configured.</p>
        ) : (
          <ul className="chip-list">
            {data.trackedSymbols.map((symbol) => (
              <li key={symbol} className="chip">
                {symbol}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h3>Quote Provider Swap Location</h3>
        <p className="muted">
          To add a new provider, implement the QuoteProvider interface and register it in
          backend/src/services/quotes/createQuoteService.ts.
        </p>
        <p className="muted">
          In normal mode, demo fallback is disabled by default and Yahoo failures keep existing cached data.
        </p>
      </section>
    </section>
  );
}
