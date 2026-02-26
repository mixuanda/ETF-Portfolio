import { useEffect, useState } from "react";
import type { PortfolioResponse } from "@portfolio/shared";
import { api } from "../api/client";
import { AllocationBars } from "../components/AllocationBars";
import { formatCurrency, formatSignedCurrency, numberTone } from "../utils/format";

export function AnalysisPage(): JSX.Element {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await api.getPortfolio();
        if (active) {
          setData(response);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load analysis");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p>Loading analysis...</p>;
  }

  if (error || !data) {
    return <p className="error">{error ?? "Analysis unavailable"}</p>;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <h2>Analysis</h2>
        <p className="muted">
          Allocation breakdown by category, region, strategy, and defensive vs growth positioning.
        </p>
      </div>

      <section className="stats-grid stats-grid--compact">
        <article className="stat-card">
          <p className="stat-card__label">Total Portfolio Value</p>
          <p className="stat-card__value">{formatCurrency(data.summary.totalMarketValue)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-card__label">Total Unrealized P/L</p>
          <p className={`stat-card__value stat-card__value--${numberTone(data.summary.totalUnrealizedPL)}`}>
            {formatSignedCurrency(data.summary.totalUnrealizedPL)}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-card__label">Total Dividends Received</p>
          <p className="stat-card__value">{formatCurrency(data.summary.totalDividends)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-card__label">Total Return</p>
          <p className={`stat-card__value stat-card__value--${numberTone(data.summary.totalReturn)}`}>
            {formatSignedCurrency(data.summary.totalReturn)}
          </p>
        </article>
      </section>

      <div className="two-col">
        <AllocationBars title="Allocation by Asset Category" buckets={data.allocations.byAssetType} />
        <AllocationBars title="Allocation by Region" buckets={data.allocations.byRegion} />
      </div>

      <div className="two-col">
        <AllocationBars title="Allocation by Strategy Label" buckets={data.allocations.byStrategyLabel} />
        <AllocationBars title="Defensive vs Growth" buckets={data.allocations.byRiskGroup} />
      </div>
    </section>
  );
}
