import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..", "..");
const rootDir = path.resolve(backendDir, "..");

const schemaPath = path.resolve(rootDir, "database", "schema.sql");
const instrumentsPath = path.resolve(rootDir, "database", "instruments.sql");
const seedPath = path.resolve(rootDir, "database", "seed.sql");

function runSqlFile(filePath: string): void {
  const sql = fs.readFileSync(filePath, "utf8");
  db.exec(sql);
}

function ensureSchemaCompatibility(): void {
  const snapshotColumns = db.prepare("PRAGMA table_info(asset_snapshots)").all() as Array<{
    name: string;
  }>;
  const hasStatusColumn = snapshotColumns.some((column) => column.name === "status");

  if (!hasStatusColumn) {
    db.exec("ALTER TABLE asset_snapshots ADD COLUMN status TEXT NOT NULL DEFAULT 'success'");
  }

  const transactionColumns = db.prepare("PRAGMA table_info(transactions)").all() as Array<{
    name: string;
  }>;

  if (!transactionColumns.some((column) => column.name === "fee_mode")) {
    db.exec(
      "ALTER TABLE transactions ADD COLUMN fee_mode TEXT NOT NULL DEFAULT 'manual' CHECK (fee_mode IN ('manual', 'auto_hsbc_trade25'))"
    );
  }
  if (!transactionColumns.some((column) => column.name === "brokerage_fee")) {
    db.exec("ALTER TABLE transactions ADD COLUMN brokerage_fee REAL NOT NULL DEFAULT 0");
  }
  if (!transactionColumns.some((column) => column.name === "stamp_duty")) {
    db.exec("ALTER TABLE transactions ADD COLUMN stamp_duty REAL NOT NULL DEFAULT 0");
  }
  if (!transactionColumns.some((column) => column.name === "transaction_levy")) {
    db.exec("ALTER TABLE transactions ADD COLUMN transaction_levy REAL NOT NULL DEFAULT 0");
  }
  if (!transactionColumns.some((column) => column.name === "trading_fee")) {
    db.exec("ALTER TABLE transactions ADD COLUMN trading_fee REAL NOT NULL DEFAULT 0");
  }

  const dividendColumns = db.prepare("PRAGMA table_info(dividends)").all() as Array<{ name: string }>;
  if (!dividendColumns.some((column) => column.name === "event_label")) {
    db.exec("ALTER TABLE dividends ADD COLUMN event_label TEXT NOT NULL DEFAULT ''");
  }
}

function ensureInstrumentCatalogBaseline(): void {
  db.exec(`
    INSERT INTO instruments (
      symbol,
      name_en,
      asset_type,
      issuer,
      currency,
      region,
      search_keywords,
      is_active,
      updated_at
    )
    SELECT
      h.symbol,
      h.name,
      h.asset_type,
      '',
      h.currency,
      h.region,
      lower(h.symbol || ' ' || h.name),
      1,
      CURRENT_TIMESTAMP
    FROM holdings h
    WHERE NOT EXISTS (
      SELECT 1
      FROM instruments i
      WHERE i.symbol = h.symbol
    )
  `);
}

function ensureInstrumentCatalogCorrections(): void {
  db.exec(`
    INSERT INTO instruments (
      symbol,
      name_en,
      name_zh,
      asset_type,
      issuer,
      currency,
      region,
      search_keywords,
      is_active,
      updated_at
    ) VALUES (
      '03417',
      'Global X Hang Seng TECH Covered Call Active ETF',
      'Global X 恒生科技備兌認購期權主動型ETF',
      'equity etf',
      'Mirae Asset Global Investments (Hong Kong) Limited',
      'HKD',
      'Hong Kong',
      'covered call options income tech 02006 legacy',
      1,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(symbol)
    DO UPDATE SET
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
  `);

  db.exec(`
    UPDATE instruments
    SET is_active = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE symbol = '02006'
  `);
}

export function initializeDatabase(options?: { seed?: boolean }): {
  seeded: boolean;
} {
  runSqlFile(schemaPath);
  runSqlFile(instrumentsPath);
  ensureSchemaCompatibility();
  ensureInstrumentCatalogBaseline();
  ensureInstrumentCatalogCorrections();

  let seeded = false;
  const shouldSeed = Boolean(options?.seed);

  if (shouldSeed) {
    runSqlFile(seedPath);
    seeded = true;
  }

  return { seeded };
}
