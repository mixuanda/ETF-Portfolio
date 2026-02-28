import { z } from "zod";

const symbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(16)
  .regex(/^[A-Za-z0-9.-]+$/, "Symbol must be alphanumeric and may include . or -")
  .transform((value) => value.toUpperCase());

const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .regex(/^[A-Za-z0-9.-]+$/, "Code must be alphanumeric and may include . or -")
  .transform((value) => value.toUpperCase());

const labelSchema = z.string().trim().min(1).max(60);
const optionalTextSchema = z.string().trim().max(500).optional().default("");

const currencySchema = z
  .string()
  .trim()
  .min(3)
  .max(6)
  .transform((value) => value.toUpperCase());

const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .default([])
  .transform((items) => [...new Set(items)]);

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format");

export const createHoldingSchema = z.object({
  symbol: symbolSchema,
  name: z.string().trim().min(1).max(120),
  assetType: labelSchema,
  quantity: z.number().finite().nonnegative(),
  averageCost: z.number().finite().nonnegative(),
  currency: currencySchema,
  region: labelSchema.default("Hong Kong"),
  strategyLabel: labelSchema.default("core"),
  riskGroup: labelSchema.default("growth"),
  tags: tagsSchema,
  notes: optionalTextSchema
});

export const updateHoldingSchema = createHoldingSchema.partial();

export const createManualAssetSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1).max(120),
  assetType: labelSchema,
  quantity: z.number().finite().nonnegative(),
  averageCost: z.number().finite().nonnegative(),
  currency: currencySchema,
  manualPrice: z.number().finite().nonnegative(),
  region: labelSchema.default("Global"),
  strategyLabel: labelSchema.default("manual"),
  riskGroup: labelSchema.default("defensive"),
  tags: tagsSchema,
  notes: optionalTextSchema
});

export const updateManualAssetSchema = createManualAssetSchema.partial();

export const createDividendSchema = z.object({
  symbol: symbolSchema,
  exDividendDate: dateSchema,
  paymentDate: dateSchema,
  eventLabel: z.string().trim().max(120).optional().default(""),
  dividendPerUnit: z.number().finite().nonnegative(),
  receivedAmount: z.number().finite().nonnegative(),
  currency: currencySchema.default("HKD"),
  notes: optionalTextSchema
});

export const updateDividendSchema = createDividendSchema.partial();

export const createWatchlistSchema = z.object({
  symbol: symbolSchema,
  notes: optionalTextSchema
});

export const createTransactionSchema = z.object({
  symbol: symbolSchema,
  transactionType: z.enum(["BUY", "SELL"]),
  quantity: z.number().finite().positive(),
  price: z.number().finite().nonnegative(),
  feeMode: z.enum(["manual", "auto_hsbc_trade25"]).optional().default("manual"),
  fee: z.number().finite().nonnegative().optional().default(0),
  brokerageFee: z.number().finite().nonnegative().optional(),
  stampDuty: z.number().finite().nonnegative().optional(),
  transactionLevy: z.number().finite().nonnegative().optional(),
  tradingFee: z.number().finite().nonnegative().optional(),
  otherFee: z.number().finite().nonnegative().optional(),
  tradeDate: dateSchema.optional().nullable(),
  notes: optionalTextSchema
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const updateSettingsSchema = z.object({
  quoteProvider: z.enum(["yahoo", "demo"]).optional(),
  refreshTimeoutMs: z.number().int().min(1000).max(20000).optional(),
  refreshRetries: z.number().int().min(0).max(3).optional(),
  customTags: tagsSchema.optional(),
  baseCurrency: currencySchema.optional()
});
