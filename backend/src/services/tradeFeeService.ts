import { roundMoney } from "@portfolio/shared";

export interface TransactionFeeBreakdown {
  feeMode: "manual" | "auto_hsbc_trade25";
  fee: number;
  stampDutyExempt: boolean;
  brokerageFee: number;
  stampDuty: number;
  transactionLevy: number;
  tradingFee: number;
  otherFee: number;
}

const TRADE25_PROFILE = {
  brokerageFlatFee: 0,
  stampDutyRate: 0.001,
  transactionLevyRate: 0.0000285,
  tradingFeeRate: 0.0000565
} as const;

function roundUpDollar(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.ceil(value);
}

export function calculateHkTrade25Fees(
  tradeAmount: number,
  options?: { stampDutyExempt?: boolean }
): TransactionFeeBreakdown {
  if (!Number.isFinite(tradeAmount) || tradeAmount < 0) {
    throw new Error("Trade amount must be a valid non-negative number.");
  }

  if (tradeAmount === 0) {
    return {
      feeMode: "auto_hsbc_trade25",
      fee: 0,
      stampDutyExempt: Boolean(options?.stampDutyExempt),
      brokerageFee: 0,
      stampDuty: 0,
      transactionLevy: 0,
      tradingFee: 0,
      otherFee: 0
    };
  }

  const brokerageFee = roundMoney(TRADE25_PROFILE.brokerageFlatFee);
  const stampDutyExempt = Boolean(options?.stampDutyExempt);
  const stampDuty = stampDutyExempt ? 0 : roundUpDollar(tradeAmount * TRADE25_PROFILE.stampDutyRate);
  const transactionLevy = roundMoney(tradeAmount * TRADE25_PROFILE.transactionLevyRate);
  const tradingFee = roundMoney(tradeAmount * TRADE25_PROFILE.tradingFeeRate);
  const fee = roundMoney(brokerageFee + stampDuty + transactionLevy + tradingFee);

  return {
    feeMode: "auto_hsbc_trade25",
    fee,
    stampDutyExempt,
    brokerageFee,
    stampDuty,
    transactionLevy,
    tradingFee,
    otherFee: 0
  };
}

function normalizeComponent(value: number | undefined, label: string): number {
  if (value == null) {
    return 0;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a valid non-negative number.`);
  }

  return roundMoney(value);
}

export function normalizeManualFee(input: {
  fee: number;
  stampDutyExempt?: boolean;
  brokerageFee?: number;
  stampDuty?: number;
  transactionLevy?: number;
  tradingFee?: number;
  otherFee?: number;
}): TransactionFeeBreakdown {
  const normalizedTotalFee = normalizeComponent(input.fee, "Fee");
  const hasDetailedParts =
    input.brokerageFee != null ||
    input.stampDuty != null ||
    input.transactionLevy != null ||
    input.tradingFee != null ||
    input.otherFee != null;

  const brokerageFee = normalizeComponent(input.brokerageFee, "Brokerage fee");
  const stampDuty = normalizeComponent(input.stampDuty, "Stamp duty");
  const transactionLevy = normalizeComponent(input.transactionLevy, "Transaction levy");
  const tradingFee = normalizeComponent(input.tradingFee, "Trading fee");
  const otherFee = normalizeComponent(input.otherFee, "Other fee");

  const detailedTotal = roundMoney(
    brokerageFee + stampDuty + transactionLevy + tradingFee + otherFee
  );

  const fee = hasDetailedParts ? detailedTotal : normalizedTotalFee;

  return {
    feeMode: "manual",
    fee,
    stampDutyExempt: Boolean(input.stampDutyExempt),
    brokerageFee: hasDetailedParts ? brokerageFee : 0,
    stampDuty: hasDetailedParts ? stampDuty : 0,
    transactionLevy: hasDetailedParts ? transactionLevy : 0,
    tradingFee: hasDetailedParts ? tradingFee : 0,
    otherFee: hasDetailedParts ? otherFee : fee
  };
}
