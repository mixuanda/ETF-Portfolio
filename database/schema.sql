PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity >= 0),
  average_cost REAL NOT NULL CHECK (average_cost >= 0),
  currency TEXT NOT NULL DEFAULT 'HKD',
  region TEXT NOT NULL DEFAULT 'Hong Kong',
  strategy_label TEXT NOT NULL DEFAULT 'core',
  risk_group TEXT NOT NULL DEFAULT 'growth',
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manual_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity >= 0),
  average_cost REAL NOT NULL CHECK (average_cost >= 0),
  currency TEXT NOT NULL DEFAULT 'HKD',
  manual_price REAL NOT NULL CHECK (manual_price >= 0),
  region TEXT NOT NULL DEFAULT 'Global',
  strategy_label TEXT NOT NULL DEFAULT 'manual',
  risk_group TEXT NOT NULL DEFAULT 'defensive',
  tags TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  price_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  change_amount REAL,
  change_percent REAL,
  currency TEXT NOT NULL DEFAULT 'HKD',
  provider TEXT NOT NULL,
  as_of TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_snapshots_symbol_fetched
  ON asset_snapshots (symbol, fetched_at DESC);

CREATE TABLE IF NOT EXISTS dividends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  ex_dividend_date TEXT,
  payment_date TEXT NOT NULL,
  dividend_per_unit REAL NOT NULL CHECK (dividend_per_unit >= 0),
  received_amount REAL NOT NULL CHECK (received_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'HKD',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dividends_symbol_payment
  ON dividends (symbol, payment_date DESC);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
