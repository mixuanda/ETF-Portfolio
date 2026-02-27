import type { RefreshStatus } from "@portfolio/shared";
import { useI18n } from "../i18n/provider";

interface StatusPillProps {
  status: RefreshStatus;
}

export function StatusPill({ status }: StatusPillProps): JSX.Element {
  const { t } = useI18n();
  return <span className={`status-pill status-pill--${status}`}>{t(`status.${status}`)}</span>;
}
