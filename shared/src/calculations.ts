import type { AllocationBucket, PositionMetrics } from "./types.js";

const MONEY_PRECISION = 2;

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const factor = 10 ** MONEY_PRECISION;
  return Math.round(value * factor) / factor;
}

export function roundPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

export function calculatePositionMetrics(input: {
  quantity: number;
  averageCost: number;
  currentPrice: number;
  changeAmount?: number | null;
}): PositionMetrics {
  const costBasis = input.quantity * input.averageCost;
  const marketValue = input.quantity * input.currentPrice;
  const unrealizedPL = marketValue - costBasis;
  const unrealizedReturnPct = costBasis === 0 ? 0 : (unrealizedPL / costBasis) * 100;
  const todayChange = input.changeAmount == null ? null : input.changeAmount * input.quantity;

  return {
    currentPrice: roundMoney(input.currentPrice),
    marketValue: roundMoney(marketValue),
    costBasis: roundMoney(costBasis),
    unrealizedPL: roundMoney(unrealizedPL),
    unrealizedReturnPct: roundPercent(unrealizedReturnPct),
    todayChange: todayChange == null ? null : roundMoney(todayChange)
  };
}

export function buildAllocationBuckets(
  values: Array<{ label: string; value: number }>,
  totalValue: number
): AllocationBucket[] {
  if (totalValue <= 0) {
    return [];
  }

  const sorted = [...values]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  return sorted.map((item) => ({
    label: item.label,
    value: roundMoney(item.value),
    percentage: roundPercent((item.value / totalValue) * 100)
  }));
}
