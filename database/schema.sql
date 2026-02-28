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

CREATE TABLE IF NOT EXISTS instruments (
  symbol TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  asset_type TEXT NOT NULL,
  issuer TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'HKD',
  region TEXT NOT NULL DEFAULT 'Hong Kong',
  search_keywords TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_instruments_symbol
  ON instruments (symbol);

CREATE INDEX IF NOT EXISTS idx_instruments_name_en
  ON instruments (name_en COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_instruments_name_zh
  ON instruments (name_zh);

CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL UNIQUE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (symbol) REFERENCES instruments(symbol)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('BUY', 'SELL')),
  quantity REAL NOT NULL CHECK (quantity > 0),
  price REAL NOT NULL CHECK (price >= 0),
  fee REAL NOT NULL DEFAULT 0 CHECK (fee >= 0),
  fee_mode TEXT NOT NULL DEFAULT 'manual' CHECK (fee_mode IN ('manual', 'auto_hsbc_trade25')),
  stamp_duty_exempt INTEGER NOT NULL DEFAULT 0 CHECK (stamp_duty_exempt IN (0, 1)),
  brokerage_fee REAL NOT NULL DEFAULT 0 CHECK (brokerage_fee >= 0),
  stamp_duty REAL NOT NULL DEFAULT 0 CHECK (stamp_duty >= 0),
  transaction_levy REAL NOT NULL DEFAULT 0 CHECK (transaction_levy >= 0),
  trading_fee REAL NOT NULL DEFAULT 0 CHECK (trading_fee >= 0),
  trade_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (symbol) REFERENCES instruments(symbol)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_transactions_symbol_trade
  ON transactions (symbol, trade_date DESC, id DESC);

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
  status TEXT NOT NULL DEFAULT 'success',
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_snapshots_symbol_fetched
  ON asset_snapshots (symbol, fetched_at DESC);

CREATE TABLE IF NOT EXISTS dividends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  ex_dividend_date TEXT,
  payment_date TEXT NOT NULL,
  event_label TEXT NOT NULL DEFAULT '',
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
