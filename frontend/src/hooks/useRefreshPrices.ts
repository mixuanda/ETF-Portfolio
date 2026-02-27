import { useEffect, useState } from "react";
import type { RefreshStatus } from "@portfolio/shared";
import { api } from "../api/client";
import { useI18n } from "../i18n/provider";

export function useRefreshPrices(onCompleted?: () => Promise<void> | void): {
  refreshStatus: RefreshStatus;
  refreshMessage: string;
  isRefreshing: boolean;
  triggerRefresh: () => Promise<void>;
} {
  const { t, locale } = useI18n();
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>("idle");
  const [refreshMessage, setRefreshMessage] = useState<string>(t("refresh.waiting"));

  useEffect(() => {
    if (refreshStatus === "idle") {
      setRefreshMessage(t("refresh.waiting"));
    }
  }, [locale, refreshStatus, t]);

  async function triggerRefresh(): Promise<void> {
    setRefreshStatus("refreshing");
    setRefreshMessage(t("refresh.refreshing"));

    try {
      const result = await api.refreshPrices();
      setRefreshStatus(result.status);
      setRefreshMessage(result.message);

      if (onCompleted) {
        await onCompleted();
      }
    } catch (error) {
      setRefreshStatus("failed");
      setRefreshMessage(
        error instanceof Error ? error.message : t("refresh.failedUnexpected")
      );
    }
  }

  return {
    refreshStatus,
    refreshMessage,
    isRefreshing: refreshStatus === "refreshing",
    triggerRefresh
  };
}
