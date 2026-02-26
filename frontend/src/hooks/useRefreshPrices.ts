import { useState } from "react";
import type { RefreshStatus } from "@portfolio/shared";
import { api } from "../api/client";

export function useRefreshPrices(onCompleted?: () => Promise<void> | void): {
  refreshStatus: RefreshStatus;
  refreshMessage: string;
  isRefreshing: boolean;
  triggerRefresh: () => Promise<void>;
} {
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>("idle");
  const [refreshMessage, setRefreshMessage] = useState<string>("Waiting for manual refresh.");

  async function triggerRefresh(): Promise<void> {
    setRefreshStatus("refreshing");
    setRefreshMessage("Refreshing delayed quote cache...");

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
        error instanceof Error ? error.message : "Refresh failed due to an unexpected error."
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
