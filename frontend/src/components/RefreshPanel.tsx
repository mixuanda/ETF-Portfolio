import type { RefreshStatus } from "@portfolio/shared";
import { formatDateTime } from "../utils/format";
import { useI18n } from "../i18n/provider";
import { StatusPill } from "./StatusPill";

interface RefreshPanelProps {
  status: RefreshStatus;
  message: string;
  lastRefreshAt: string | null;
  lastRefreshProvider: string | null;
  demoModeEnabled?: boolean;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

export function RefreshPanel({
  status,
  message,
  lastRefreshAt,
  lastRefreshProvider,
  demoModeEnabled = false,
  onRefresh,
  disabled = false
}: RefreshPanelProps): JSX.Element {
  const { t } = useI18n();
  const isUsingCachedData = status !== "refreshing";

  return (
    <section className="panel refresh-panel">
      {demoModeEnabled ? (
        <div className="warning-banner warning-banner--demo">
          <strong>{t("app.demo.title")}</strong>
          <span>{t("app.demo.subtitle")}</span>
        </div>
      ) : null}

      <div className="refresh-panel__row">
        <h3>{t("refreshPanel.title")}</h3>
        <StatusPill status={status} />
      </div>

      {status === "failed" ? (
        <div className="warning-banner warning-banner--failed">
          {t("refreshPanel.failedBanner")}
        </div>
      ) : null}

      {status === "partial_success" ? (
        <div className="warning-banner warning-banner--failed">
          {t("refreshPanel.partialBanner")}
        </div>
      ) : null}

      <p className="muted">
        {t("refreshPanel.lastUpdated", {
          value: formatDateTime(lastRefreshAt, t("format.notRefreshedYet"))
        })}
      </p>
      <p className="muted">
        {t("refreshPanel.source", {
          value: lastRefreshProvider ?? t("refreshPanel.sourceEmpty")
        })}
      </p>
      <p className="muted">
        {t("refreshPanel.displaying", {
          value: isUsingCachedData
            ? t("refreshPanel.cachedSnapshot")
            : t("refreshPanel.cachedRefreshing")
        })}
      </p>
      <p>{message}</p>
      <button type="button" className="btn btn--primary" onClick={() => void onRefresh()} disabled={disabled}>
        {disabled ? t("refreshPanel.refreshingBtn") : t("refreshPanel.refresh")}
      </button>
    </section>
  );
}
