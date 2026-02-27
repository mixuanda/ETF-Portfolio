INSERT INTO instruments (
  symbol,
  name_en,
  name_zh,
  asset_type,
  issuer,
  currency,
  region,
  search_keywords,
  is_active
) VALUES
  ('02800', 'Tracker Fund of Hong Kong', '盈富基金', 'equity etf', 'State Street', 'HKD', 'Hong Kong', 'hang seng index hsi large cap hk equity', 1),
  ('03010', 'Hang Seng TECH ETF', '恒生科技ETF', 'equity etf', 'Hang Seng Investment', 'HKD', 'Hong Kong', 'tech growth internet innovation', 1),
  ('02100', 'ABF Hong Kong Bond Index Fund', 'ABF香港創富債券指數基金', 'bond etf', 'Hong Kong Monetary Authority', 'HKD', 'Hong Kong', 'bond fixed income hkd government', 1),
  ('03417', 'Global X Hang Seng TECH Covered Call Active ETF', 'Global X 恒生科技備兌認購期權主動型ETF', 'equity etf', 'Mirae Asset Global Investments (Hong Kong) Limited', 'HKD', 'Hong Kong', 'covered call options income tech 02006 legacy', 1),
  ('03153', 'China Government Bond ETF', '中國國債ETF', 'bond etf', 'CSOP', 'HKD', 'China', 'china government bond defensive', 1),
  ('03195', 'Asia Investment Grade Bond ETF', '亞洲投資級別債券ETF', 'bond etf', 'Value Partners', 'HKD', 'Asia', 'investment grade bond income', 1),
  ('03421', 'US Treasury 20Y ETF', '美國20年期國債ETF', 'bond etf', 'CSOP', 'HKD', 'United States', 'us treasury duration hedge bond', 1),
  ('03450', 'Money Market ETF', '貨幣市場ETF', 'money market etf', 'Value Partners', 'HKD', 'Hong Kong', 'cash liquidity hkd', 1),
  ('03466', 'Global Dividend ETF', '環球股息ETF', 'equity etf', 'ChinaAMC', 'HKD', 'Global', 'dividend income global equity', 1)
ON CONFLICT(symbol) DO UPDATE SET
  name_en = excluded.name_en,
  name_zh = CASE
    WHEN instruments.name_zh = '' THEN excluded.name_zh
    ELSE instruments.name_zh
  END,
  asset_type = excluded.asset_type,
  issuer = CASE
    WHEN instruments.issuer = '' THEN excluded.issuer
    ELSE instruments.issuer
  END,
  currency = excluded.currency,
  region = excluded.region,
  search_keywords = CASE
    WHEN instruments.search_keywords = '' THEN excluded.search_keywords
    ELSE instruments.search_keywords
  END,
  is_active = excluded.is_active,
  updated_at = CURRENT_TIMESTAMP;
