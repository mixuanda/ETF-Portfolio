import type { AllocationBucket } from "@portfolio/shared";
import { formatCurrency } from "../utils/format";

interface AllocationBarsProps {
  title: string;
  buckets: AllocationBucket[];
}

export function AllocationBars({ title, buckets }: AllocationBarsProps): JSX.Element {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {buckets.length === 0 ? (
        <p className="muted">No allocation data yet.</p>
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
