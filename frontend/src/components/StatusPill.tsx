import type { RefreshStatus } from "@portfolio/shared";

interface StatusPillProps {
  status: RefreshStatus;
}

const statusLabelMap: Record<RefreshStatus, string> = {
  idle: "idle",
  refreshing: "refreshing",
  success: "success",
  partial_success: "partial success",
  failed: "failed"
};

export function StatusPill({ status }: StatusPillProps): JSX.Element {
  return <span className={`status-pill status-pill--${status}`}>{statusLabelMap[status]}</span>;
}
