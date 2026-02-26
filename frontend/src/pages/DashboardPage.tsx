import { useCallback, useEffect, useMemo, useState } from "react";
import type { DividendsResponse, PortfolioResponse, RefreshStatus } from "@portfolio/shared";
import { api } from "../api/client";
import { AllocationBars } from "../components/AllocationBars";
import { RefreshPanel } from "../components/RefreshPanel";
import { StatCard } from "../components/StatCard";
import { useRefreshPrices } from "../hooks/useRefreshPrices";
import {
  formatCurrency,
  formatDateTime,
  formatSignedCurrency,
  numberTone
} from "../utils/format";

export function DashboardPage(): JSX.Element {
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
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

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
      ? "Cached prices loaded. Use Refresh Prices when you want delayed updates."
      : refreshMessage;

  const recentDividendCount = useMemo(() => portfolio?.recentDividends.length ?? 0, [portfolio]);

  if (loading) {
    return <p>Loading dashboard...</p>;
  }

  if (error || !portfolio) {
    return <p className="error">{error ?? "Dashboard data unavailable"}</p>;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p className="muted">Overview of total value, return, allocation, and recent dividends.</p>
      </div>

      <RefreshPanel
        status={effectiveStatus}
        message={activeRefreshMessage}
        lastRefreshAt={portfolio.summary.lastRefreshAt}
        onRefresh={triggerRefresh}
        disabled={isRefreshing}
      />

      <section className="stats-grid">
        <StatCard
          label="Total Portfolio Value"
          value={formatCurrency(portfolio.summary.totalMarketValue)}
          helper={`${portfolio.summary.holdingsCount} ETF holdings + ${portfolio.summary.manualAssetsCount} manual assets`}
        />
        <StatCard
          label="Total Unrealized P/L"
          value={formatSignedCurrency(portfolio.summary.totalUnrealizedPL)}
          tone={numberTone(portfolio.summary.totalUnrealizedPL)}
          helper={`${portfolio.summary.totalUnrealizedReturnPct.toFixed(2)}% unrealized return`}
        />
        <StatCard
          label="Total Return"
          value={formatSignedCurrency(portfolio.summary.totalReturn)}
          tone={numberTone(portfolio.summary.totalReturn)}
          helper="Unrealized P/L + received dividends"
        />
        <StatCard
          label="Today's Approximate Change"
          value={formatSignedCurrency(portfolio.summary.todayApproxChange)}
          tone={numberTone(portfolio.summary.todayApproxChange)}
          helper={`Last refresh: ${formatDateTime(portfolio.summary.lastRefreshAt)}`}
        />
      </section>

      <section className="panel">
        <h3>Allocation Summary</h3>
        <p className="muted">By asset type and region based on latest cached prices.</p>
        <div className="two-col">
          <AllocationBars title="By Asset Type" buckets={portfolio.allocations.byAssetType} />
          <AllocationBars title="By Region" buckets={portfolio.allocations.byRegion} />
        </div>
      </section>

      <section className="panel">
        <h3>Recent Dividend Summary</h3>
        <p className="muted">
          {recentDividendCount} recent entries. Total dividends received: {formatCurrency(dividends?.summary.totalReceived ?? 0)}
        </p>
        {portfolio.recentDividends.length === 0 ? (
          <p className="muted">No dividend records yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Ex-Date</th>
                  <th>Payment Date</th>
                  <th>Per Unit</th>
                  <th>Received</th>
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
