import { useCallback, useEffect, useMemo, useState } from "react";
import type { DividendsResponse, PortfolioResponse, RefreshStatus } from "@portfolio/shared";
import { api } from "../api/client";
import { AllocationBars } from "../components/AllocationBars";
import { RefreshPanel } from "../components/RefreshPanel";
import { StatCard } from "../components/StatCard";
import { useRefreshPrices } from "../hooks/useRefreshPrices";
import { useI18n } from "../i18n/provider";
import {
  formatCurrency,
  formatSignedCurrency,
  numberTone
} from "../utils/format";

export function DashboardPage(): JSX.Element {
  const { t } = useI18n();
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [dividends, setDividends] = useState<DividendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [portfolioResponse, dividendsResponse] = await Promise.all([
        api.getPortfolio(),
        api.getDividends()
      ]);
      setPortfolio(portfolioResponse);
      setDividends(dividendsResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("common.notAvailable"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const { refreshStatus, refreshMessage, isRefreshing, triggerRefresh } = useRefreshPrices(loadData);

  const effectiveStatus: RefreshStatus =
    refreshStatus === "idle" && portfolio
      ? portfolio.summary.lastRefreshStatus
      : refreshStatus;

  const activeRefreshMessage =
    refreshStatus === "idle"
      ? effectiveStatus === "failed" || effectiveStatus === "partial_success"
        ? portfolio?.summary.lastRefreshError ??
          t("dashboard.refreshFailedFallback")
        : t("dashboard.refreshIdle")
      : refreshMessage;

  const recentDividendCount = useMemo(() => portfolio?.recentDividends.length ?? 0, [portfolio]);

  if (loading) {
    return <p>{t("common.loadingDashboard")}</p>;
  }

  if (error || !portfolio) {
    return <p className="error">{error ?? t("common.notAvailable")}</p>;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <h2>{t("dashboard.title")}</h2>
        <p className="muted">{t("dashboard.subtitle")}</p>
      </div>

      <RefreshPanel
        status={effectiveStatus}
        message={activeRefreshMessage}
        lastRefreshAt={portfolio.summary.lastRefreshAt}
        lastRefreshProvider={portfolio.summary.lastRefreshProvider}
        onRefresh={triggerRefresh}
        disabled={isRefreshing}
      />

      <section className="stats-grid">
        <StatCard
          label={t("dashboard.stat.totalValue")}
          value={formatCurrency(portfolio.summary.totalMarketValue)}
          helper={t("dashboard.helper.holdingsCount", {
            holdings: portfolio.summary.holdingsCount,
            manual: portfolio.summary.manualAssetsCount
          })}
        />
        <StatCard
          label={t("dashboard.stat.totalUnrealized")}
          value={formatSignedCurrency(portfolio.summary.totalUnrealizedPL)}
          tone={numberTone(portfolio.summary.totalUnrealizedPL)}
          helper={t("dashboard.helper.unrealizedReturn", {
            value: portfolio.summary.totalUnrealizedReturnPct.toFixed(2)
          })}
        />
        <StatCard
          label={t("dashboard.stat.totalReturn")}
          value={formatSignedCurrency(portfolio.summary.totalReturn)}
          tone={numberTone(portfolio.summary.totalReturn)}
          helper={t("dashboard.helper.totalReturn")}
        />
        <StatCard
          label={t("dashboard.stat.todayReturn")}
          value={formatSignedCurrency(portfolio.summary.todayApproxChange)}
          tone={numberTone(portfolio.summary.todayApproxChange)}
          helper={t("dashboard.helper.todayReturnPct", {
            value: portfolio.summary.todayReturnPct.toFixed(2)
          })}
        />
      </section>

      <section className="panel">
        <h3>{t("dashboard.alloc.title")}</h3>
        <p className="muted">{t("dashboard.alloc.subtitle")}</p>
        <div className="two-col">
          <AllocationBars title={t("dashboard.alloc.byAsset")} buckets={portfolio.allocations.byAssetType} />
          <AllocationBars title={t("dashboard.alloc.byRegion")} buckets={portfolio.allocations.byRegion} />
        </div>
      </section>

      <section className="panel">
        <h3>{t("dashboard.dividend.title")}</h3>
        <p className="muted">
          {t("dashboard.dividend.subtitle", {
            count: recentDividendCount,
            value: formatCurrency(dividends?.summary.totalReceived ?? 0)
          })}
        </p>
        {portfolio.recentDividends.length === 0 ? (
          <p className="muted">{t("dashboard.dividend.empty")}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("dashboard.table.symbol")}</th>
                  <th>{t("dashboard.table.exDate")}</th>
                  <th>{t("dashboard.table.paymentDate")}</th>
                  <th>{t("dashboard.table.perUnit")}</th>
                  <th>{t("dashboard.table.received")}</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.recentDividends.map((record) => (
                  <tr key={record.id}>
                    <td>{record.symbol}</td>
                    <td>{record.exDividendDate ?? "-"}</td>
                    <td>{record.paymentDate}</td>
                    <td>{formatCurrency(record.dividendPerUnit, record.currency)}</td>
                    <td>{formatCurrency(record.receivedAmount, record.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
