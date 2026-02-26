import type { RefreshStatus } from "@portfolio/shared";
import { formatDateTime } from "../utils/format";
import { StatusPill } from "./StatusPill";

interface RefreshPanelProps {
  status: RefreshStatus;
  message: string;
  lastRefreshAt: string | null;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

export function RefreshPanel({
  status,
  message,
  lastRefreshAt,
  onRefresh,
  disabled = false
}: RefreshPanelProps): JSX.Element {
  return (
    <section className="panel refresh-panel">
      <div className="refresh-panel__row">
        <h3>Price Cache</h3>
        <StatusPill status={status} />
      </div>
      <p className="muted">Last updated: {formatDateTime(lastRefreshAt)}</p>
      <p>{message}</p>
      <button type="button" className="btn btn--primary" onClick={() => void onRefresh()} disabled={disabled}>
        {disabled ? "Refreshing..." : "Refresh Prices"}
      </button>
    </section>
  );
}
