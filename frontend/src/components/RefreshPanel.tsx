import type { RefreshStatus } from "@portfolio/shared";
import { formatDateTime } from "../utils/format";
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
  const isUsingCachedData = status !== "refreshing";

  return (
    <section className="panel refresh-panel">
      {demoModeEnabled ? (
        <div className="warning-banner warning-banner--demo">
          <strong>DEMO DATA</strong>
          <span>NOT REAL MARKET DATA</span>
        </div>
      ) : null}

      <div className="refresh-panel__row">
        <h3>Price Cache</h3>
        <StatusPill status={status} />
      </div>

      {status === "failed" ? (
        <div className="warning-banner warning-banner--failed">
          Refresh failed. Existing cached prices are still shown.
        </div>
      ) : null}

      <p className="muted">Last updated: {formatDateTime(lastRefreshAt)}</p>
      <p className="muted">Source: {lastRefreshProvider ?? "No successful refresh source yet"}</p>
      <p className="muted">
        Displaying: {isUsingCachedData ? "Cached data snapshot" : "Cached data (refresh in progress)"}
      </p>
      <p>{message}</p>
      <button type="button" className="btn btn--primary" onClick={() => void onRefresh()} disabled={disabled}>
        {disabled ? "Refreshing..." : "Refresh Prices"}
      </button>
    </section>
  );
}
