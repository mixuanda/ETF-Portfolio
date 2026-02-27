import type { AllocationBucket } from "@portfolio/shared";
import { useI18n } from "../i18n/provider";
import { formatCurrency } from "../utils/format";

interface AllocationBarsProps {
  title: string;
  buckets: AllocationBucket[];
}

export function AllocationBars({ title, buckets }: AllocationBarsProps): JSX.Element {
  const { t } = useI18n();

  return (
    <section className="panel">
      <h3>{title}</h3>
      {buckets.length === 0 ? (
        <p className="muted">{t("allocation.empty")}</p>
      ) : (
        <div className="allocation-list">
          {buckets.map((bucket) => (
            <div key={bucket.label} className="allocation-item">
              <div className="allocation-item__meta">
                <span>{bucket.label}</span>
                <span>
                  {bucket.percentage.toFixed(2)}% ({formatCurrency(bucket.value)})
                </span>
              </div>
              <div className="allocation-item__track">
                <div
                  className="allocation-item__fill"
                  style={{ width: `${Math.min(bucket.percentage, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
