import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  helper?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, tone = "neutral", helper, icon }: StatCardProps): JSX.Element {
  return (
    <article className="stat-card">
      <header className="stat-card__header">
        <p className="stat-card__label">{label}</p>
        {icon ? <span className="stat-card__icon">{icon}</span> : null}
      </header>
      <p className={`stat-card__value stat-card__value--${tone}`}>{value}</p>
      {helper ? <p className="stat-card__helper">{helper}</p> : null}
    </article>
  );
}
