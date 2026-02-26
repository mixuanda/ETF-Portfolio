INSERT OR IGNORE INTO holdings (
  symbol,
  name,
  asset_type,
  quantity,
  average_cost,
  currency,
  region,
  strategy_label,
  risk_group,
  tags,
  notes
) VALUES
  ('03010', 'Hang Seng TECH ETF', 'equity etf', 1200, 13.42, 'HKD', 'Hong Kong', 'growth', 'growth', '["equity","growth"]', 'Core HK tech exposure'),
  ('03153', 'China Government Bond ETF', 'bond etf', 800, 52.10, 'HKD', 'China', 'income', 'defensive', '["bond","defensive"]', 'Defensive bond allocation'),
  ('03195', 'Asia Investment Grade Bond ETF', 'bond etf', 550, 43.30, 'HKD', 'Asia', 'income', 'defensive', '["bond","dividend"]', 'Income-focused sleeve'),
  ('03421', 'US Treasury 20Y ETF', 'bond etf', 650, 72.25, 'HKD', 'United States', 'defensive', 'defensive', '["bond","defensive"]', 'Long duration hedge'),
  ('03450', 'Money Market ETF', 'money market etf', 1500, 10.05, 'HKD', 'Hong Kong', 'cash', 'defensive', '["money market","defensive"]', 'Liquidity bucket'),
  ('03466', 'Global Dividend ETF', 'equity etf', 900, 25.80, 'HKD', 'Global', 'dividend', 'defensive', '["equity","dividend"]', 'Dividend tilt allocation');

INSERT OR IGNORE INTO watchlist (
  symbol,
  notes
) VALUES (
  '02800',
  'Tracked for potential first buy'
);

INSERT INTO transactions (
  symbol,
  transaction_type,
  quantity,
  price,
  fee,
  trade_date,
  notes
)
SELECT
  h.symbol,
  'BUY',
  h.quantity,
  h.average_cost,
  0,
  date('now', '-90 day'),
  'Seed baseline position from summary holding'
FROM holdings h
WHERE NOT EXISTS (
  SELECT 1
  FROM transactions t
  WHERE t.symbol = h.symbol
);

INSERT OR IGNORE INTO manual_assets (
  code,
  name,
  asset_type,
  quantity,
  average_cost,
  currency,
  manual_price,
  region,
  strategy_label,
  risk_group,
  tags,
  notes,
  price_updated_at
) VALUES (
  'FLEXI-001',
  'Flexible Income Fund',
  'fund',
  1,
  100000,
  'HKD',
  102250,
  'Global',
  'income',
  'defensive',
  '["fund","defensive","dividend"]',
  'Manual NAV entry from monthly statement',
  datetime('now')
);

INSERT INTO asset_snapshots (
  symbol,
  price,
  change_amount,
  change_percent,
  currency,
  provider,
  as_of,
  fetched_at
)
SELECT '03010', 14.18, 0.12, 0.85, 'HKD', 'seed', datetime('now', '-1 day'), datetime('now', '-1 day')
WHERE NOT EXISTS (SELECT 1 FROM asset_snapshots WHERE symbol = '03010' AND provider = 'seed');

INSERT INTO asset_snapshots (
  symbol,
  price,
  change_amount,
  change_percent,
  currency,
  provider,
  as_of,
  fetched_at
)
SELECT '03153', 51.62, -0.04, -0.08, 'HKD', 'seed', datetime('now', '-1 day'), datetime('now', '-1 day')
WHERE NOT EXISTS (SELECT 1 FROM asset_snapshots WHERE symbol = '03153' AND provider = 'seed');

INSERT INTO asset_snapshots (
  symbol,
  price,
  change_amount,
  change_percent,
  currency,
  provider,
  as_of,
  fetched_at
)
SELECT '03195', 44.02, 0.06, 0.14, 'HKD', 'seed', datetime('now', '-1 day'), datetime('now', '-1 day')
WHERE NOT EXISTS (SELECT 1 FROM asset_snapshots WHERE symbol = '03195' AND provider = 'seed');

INSERT INTO asset_snapshots (
  symbol,
  price,
  change_amount,
  change_percent,
  currency,
  provider,
  as_of,
  fetched_at
)
SELECT '03421', 70.95, -0.33, -0.46, 'HKD', 'seed', datetime('now', '-1 day'), datetime('now', '-1 day')
WHERE NOT EXISTS (SELECT 1 FROM asset_snapshots WHERE symbol = '03421' AND provider = 'seed');

INSERT INTO asset_snapshots (
  symbol,
  price,
  change_amount,
  change_percent,
  currency,
  provider,
  as_of,
  fetched_at
)
SELECT '03450', 10.10, 0.00, 0.00, 'HKD', 'seed', datetime('now', '-1 day'), datetime('now', '-1 day')
WHERE NOT EXISTS (SELECT 1 FROM asset_snapshots WHERE symbol = '03450' AND provider = 'seed');

INSERT INTO asset_snapshots (
  symbol,
  price,
  change_amount,
  change_percent,
  currency,
  provider,
  as_of,
  fetched_at
)
SELECT '03466', 26.54, 0.09, 0.34, 'HKD', 'seed', datetime('now', '-1 day'), datetime('now', '-1 day')
WHERE NOT EXISTS (SELECT 1 FROM asset_snapshots WHERE symbol = '03466' AND provider = 'seed');

INSERT INTO dividends (
  symbol,
  ex_dividend_date,
  payment_date,
  dividend_per_unit,
  received_amount,
  currency,
  notes
)
SELECT '03010', '2025-10-20', '2025-11-05', 0.08, 96.00, 'HKD', 'Quarterly distribution'
WHERE NOT EXISTS (
  SELECT 1
  FROM dividends
  WHERE symbol = '03010' AND payment_date = '2025-11-05' AND received_amount = 96.00
);

INSERT INTO dividends (
  symbol,
  ex_dividend_date,
  payment_date,
  dividend_per_unit,
  received_amount,
  currency,
  notes
)
SELECT '03195', '2025-09-12', '2025-09-26', 0.15, 82.50, 'HKD', 'Monthly income'
WHERE NOT EXISTS (
  SELECT 1
  FROM dividends
  WHERE symbol = '03195' AND payment_date = '2025-09-26' AND received_amount = 82.50
);

INSERT INTO dividends (
  symbol,
  ex_dividend_date,
  payment_date,
  dividend_per_unit,
  received_amount,
  currency,
  notes
)
SELECT '03466', '2025-12-01', '2025-12-15', 0.20, 180.00, 'HKD', 'Semi-annual dividend'
WHERE NOT EXISTS (
  SELECT 1
  FROM dividends
  WHERE symbol = '03466' AND payment_date = '2025-12-15' AND received_amount = 180.00
);

INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES
  ('quote_provider', 'yahoo', CURRENT_TIMESTAMP),
  ('refresh_timeout_ms', '8000', CURRENT_TIMESTAMP),
  ('refresh_retries', '1', CURRENT_TIMESTAMP),
  ('last_refresh_status', 'success', CURRENT_TIMESTAMP),
  ('last_refresh_at', datetime('now', '-1 day'), CURRENT_TIMESTAMP),
  ('last_refresh_provider', 'seed', CURRENT_TIMESTAMP),
  ('last_refresh_error', '', CURRENT_TIMESTAMP),
  ('base_currency', 'HKD', CURRENT_TIMESTAMP),
  ('custom_tags', '["equity","bond","money market","dividend","defensive"]', CURRENT_TIMESTAMP);
