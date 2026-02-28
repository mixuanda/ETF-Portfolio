import { roundMoney } from "@portfolio/shared";

export interface TransactionFeeBreakdown {
  feeMode: "manual" | "auto_hsbc_trade25";
  fee: number;
  brokerageFee: number;
  stampDuty: number;
  transactionLevy: number;
  tradingFee: number;
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

export function calculateHkTrade25Fees(tradeAmount: number): TransactionFeeBreakdown {
  if (!Number.isFinite(tradeAmount) || tradeAmount < 0) {
    throw new Error("Trade amount must be a valid non-negative number.");
  }

  if (tradeAmount === 0) {
    return {
      feeMode: "auto_hsbc_trade25",
      fee: 0,
      brokerageFee: 0,
      stampDuty: 0,
      transactionLevy: 0,
      tradingFee: 0
    };
  }

  const brokerageFee = roundMoney(TRADE25_PROFILE.brokerageFlatFee);
  const stampDuty = roundUpDollar(tradeAmount * TRADE25_PROFILE.stampDutyRate);
  const transactionLevy = roundMoney(tradeAmount * TRADE25_PROFILE.transactionLevyRate);
  const tradingFee = roundMoney(tradeAmount * TRADE25_PROFILE.tradingFeeRate);
  const fee = roundMoney(brokerageFee + stampDuty + transactionLevy + tradingFee);

  return {
    feeMode: "auto_hsbc_trade25",
    fee,
    brokerageFee,
    stampDuty,
    transactionLevy,
    tradingFee
  };
}

export function normalizeManualFee(fee: number): TransactionFeeBreakdown {
  const normalized = roundMoney(fee);
  return {
    feeMode: "manual",
    fee: normalized,
    brokerageFee: 0,
    stampDuty: 0,
    transactionLevy: 0,
    tradingFee: 0
  };
}
