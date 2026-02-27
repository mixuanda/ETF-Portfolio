import { useEffect, useState } from "react";
import type { PortfolioResponse } from "@portfolio/shared";
import { api } from "../api/client";
import { AllocationBars } from "../components/AllocationBars";
import { useI18n } from "../i18n/provider";
import { formatCurrency, formatSignedCurrency, numberTone } from "../utils/format";

export function AnalysisPage(): JSX.Element {
  const { t } = useI18n();
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
          setError(loadError instanceof Error ? loadError.message : t("common.notAvailable"));
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
  }, [t]);

  if (loading) {
    return <p>{t("common.loadingAnalysis")}</p>;
  }

  if (error || !data) {
    return <p className="error">{error ?? t("common.notAvailable")}</p>;
  }

  return (
    <section className="page-grid">
      <div className="page-header">
        <h2>{t("analysis.title")}</h2>
        <p className="muted">{t("analysis.subtitle")}</p>
      </div>

      <section className="stats-grid stats-grid--compact">
        <article className="stat-card">
          <p className="stat-card__label">{t("analysis.stat.totalValue")}</p>
          <p className="stat-card__value">{formatCurrency(data.summary.totalMarketValue)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-card__label">{t("analysis.stat.totalUnrealized")}</p>
          <p className={`stat-card__value stat-card__value--${numberTone(data.summary.totalUnrealizedPL)}`}>
            {formatSignedCurrency(data.summary.totalUnrealizedPL)}
          </p>
        </article>
        <article className="stat-card">
          <p className="stat-card__label">{t("analysis.stat.totalDividends")}</p>
          <p className="stat-card__value">{formatCurrency(data.summary.totalDividends)}</p>
        </article>
        <article className="stat-card">
          <p className="stat-card__label">{t("analysis.stat.totalReturn")}</p>
          <p className={`stat-card__value stat-card__value--${numberTone(data.summary.totalReturn)}`}>
            {formatSignedCurrency(data.summary.totalReturn)}
          </p>
        </article>
      </section>

      <div className="two-col">
        <AllocationBars title={t("analysis.alloc.byAsset")} buckets={data.allocations.byAssetType} />
        <AllocationBars title={t("analysis.alloc.byRegion")} buckets={data.allocations.byRegion} />
      </div>

      <div className="two-col">
        <AllocationBars title={t("analysis.alloc.byStrategy")} buckets={data.allocations.byStrategyLabel} />
        <AllocationBars title={t("analysis.alloc.byRisk")} buckets={data.allocations.byRiskGroup} />
      </div>
    </section>
  );
}
