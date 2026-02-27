import { useCallback, useEffect, useState } from "react";
import type { SettingsEnvelope } from "../api/client";
import { api } from "../api/client";
import { useI18n } from "../i18n/provider";
import { formatDateTime } from "../utils/format";

interface SettingsFormState {
  quoteProvider: "yahoo" | "demo";
  refreshTimeoutMs: string;
  refreshRetries: string;
  customTags: string;
  baseCurrency: string;
}

interface FirebaseProgramStatus {
  enabled: boolean;
  configured: boolean;
  projectId: string | null;
  portfolioId: string;
  restoreOnBoot: boolean;
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
  const { t } = useI18n();
  const [data, setData] = useState<SettingsEnvelope | null>(null);
  const [form, setForm] = useState<SettingsFormState | null>(null);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseProgramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncingInstruments, setSyncingInstruments] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncingFirebase, setSyncingFirebase] = useState(false);
  const [restoringFirebase, setRestoringFirebase] = useState(false);
  const [firebaseNotice, setFirebaseNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [settingsResponse, firebaseResponse] = await Promise.all([
        api.getSettings(),
        api.getFirebaseProgramStatus().catch(() => null)
      ]);
      setData(settingsResponse);
      setForm(mapEnvelopeToForm(settingsResponse));
      setFirebaseStatus(firebaseResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("common.notAvailable"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleSyncInstruments(): Promise<void> {
    try {
      setError(null);
      setSyncNotice(null);
      setSyncingInstruments(true);

      const result = await api.syncInstruments();
      await loadData();

      if (result.failedSymbols.length > 0) {
        setSyncNotice(
          t("settings.syncPartial", {
            updated: result.updatedSymbols.length,
            failed: result.failedSymbols.length
          })
        );
      } else {
        setSyncNotice(
          t("settings.syncOk", {
            updated: result.updatedSymbols.length
          })
        );
      }
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Unable to sync instrument metadata");
    } finally {
      setSyncingInstruments(false);
    }
  }

  async function handleSyncFirebaseProgram(): Promise<void> {
    try {
      setError(null);
      setFirebaseNotice(null);
      setSyncingFirebase(true);

      const result = await api.syncFirebaseProgram();
      await loadData();

      setFirebaseNotice(
        t("settings.firebase.syncDone", {
          symbols: result.trackedSymbolCount,
          purchases: result.purchaseCount,
          transactions: result.transactionCount
        })
      );
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Unable to sync Firebase program");
    } finally {
      setSyncingFirebase(false);
    }
  }

  async function handleRestoreFirebaseProgram(): Promise<void> {
    try {
      setError(null);
      setFirebaseNotice(null);
      setRestoringFirebase(true);

      const result = await api.restoreFirebaseProgram();
      await loadData();

      if (result.restored) {
        setFirebaseNotice(t("settings.firebase.restoreDone"));
      } else {
        setFirebaseNotice(
          t("settings.firebase.restoreSkipped", {
            reason: result.reason ?? t("settings.firebase.noCloudData")
          })
        );
      }
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Unable to restore from Firebase");
    } finally {
      setRestoringFirebase(false);
    }
  }

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
      setNotice(t("settings.saved"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update settings");
    }
  }

  if (loading) {
    return <p>{t("common.loadingSettings")}</p>;
  }

  if (error && !data) {
    return <p className="error">{error}</p>;
  }

  if (!data || !form) {
    return <p className="error">{t("common.notAvailable")}</p>;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <h2>{t("settings.title")}</h2>
        <p className="muted">{t("settings.subtitle")}</p>
      </div>

      <section className="panel">
        <h3>{t("settings.refreshConfig")}</h3>
        <p className="muted">
          {t("settings.lastStatus", { status: data.settings.lastRefreshStatus })} |{" "}
          {t("settings.lastRefreshTime", {
            time: formatDateTime(data.settings.lastRefreshAt, t("format.notRefreshedYet"))
          })}
        </p>
        <p className="muted">
          {t("settings.lastSource", {
            value: data.settings.lastRefreshProvider ?? t("settings.lastSourceEmpty")
          })}
        </p>
        <p className="muted">
          {t("settings.demoMode", {
            value: data.settings.enableDemoMode ? t("settings.enabled") : t("settings.disabled")
          })}
          {" | "}
          {t("settings.demoFallback", {
            value: data.settings.allowDemoFallback ? t("settings.enabled") : t("settings.disabled")
          })}
        </p>
        <p className="muted">
          {t("settings.hkexBackup", {
            value: data.settings.enableHkexBackup ? t("settings.enabled") : t("settings.disabled")
          })}
        </p>
        {data.settings.lastRefreshError ? (
          <p className="muted">{t("settings.latestMessage", { value: data.settings.lastRefreshError })}</p>
        ) : null}

        <form className="data-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="form-grid">
            <label>
              {t("settings.quoteProvider")}
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
                <option value="yahoo">{t("settings.quote.yahoo")}</option>
                <option value="demo" disabled={!data.settings.enableDemoMode}>
                  {t("settings.quote.demo")}
                </option>
              </select>
            </label>
            <label>
              {t("settings.timeout")}
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
              {t("settings.retries")}
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
              {t("settings.baseCurrency")}
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
              {t("settings.customTags")}
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
              {t("settings.save")}
            </button>
          </div>
          {notice ? <p className="success">{notice}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </form>
      </section>

      <section className="panel">
        <h3>{t("settings.managedSymbols")}</h3>
        <p className="muted">
          {t("settings.managedSymbolsDesc")}
        </p>
        <div className="row-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void handleSyncInstruments()}
            disabled={syncingInstruments}
          >
            {syncingInstruments ? t("settings.syncingBtn") : t("settings.syncBtn")}
          </button>
        </div>
        {syncNotice ? <p className="muted">{syncNotice}</p> : null}
        {data.trackedSymbols.length === 0 ? (
          <p className="muted">{t("settings.noSymbols")}</p>
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
        <h3>{t("settings.providerSwap")}</h3>
        <p className="muted">
          {t("settings.providerSwapDesc")}
        </p>
        <p className="muted">{t("settings.providerSwapNote")}</p>
      </section>

      <section className="panel">
        <h3>{t("settings.firebase.title")}</h3>
        <p className="muted">{t("settings.firebase.desc")}</p>

        <p className="muted">
          {t("settings.firebase.status", {
            value: firebaseStatus?.enabled ? t("settings.enabled") : t("settings.disabled")
          })}
          {" | "}
          {t("settings.firebase.credentials", {
            value: firebaseStatus?.configured ? t("settings.firebase.configured") : t("settings.firebase.missing")
          })}
        </p>

        <p className="muted">
          {t("settings.firebase.project", {
            value: firebaseStatus?.projectId ?? "n/a"
          })}
          {" | "}
          {t("settings.firebase.portfolioId", {
            value: firebaseStatus?.portfolioId ?? "default"
          })}
        </p>
        <p className="muted">
          {t("settings.firebase.restoreOnBoot", {
            value: firebaseStatus?.restoreOnBoot ? t("settings.enabled") : t("settings.disabled")
          })}
        </p>

        <div className="row-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void handleSyncFirebaseProgram()}
            disabled={syncingFirebase}
          >
            {syncingFirebase ? t("settings.firebase.syncingBtn") : t("settings.firebase.syncBtn")}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void handleRestoreFirebaseProgram()}
            disabled={restoringFirebase}
          >
            {restoringFirebase ? t("settings.firebase.restoringBtn") : t("settings.firebase.restoreBtn")}
          </button>
        </div>
        {firebaseNotice ? <p className="muted">{firebaseNotice}</p> : null}
      </section>
    </section>
  );
}
