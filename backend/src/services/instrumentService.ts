import type { InstrumentDetail, InstrumentSearchResult } from "@portfolio/shared";
import db from "../db/client.js";
import { searchHkexEtps } from "./hkexStockSearchService.js";

type InstrumentRow = {
  symbol: string;
  name_en: string;
  name_zh: string;
  asset_type: string;
  issuer: string;
  currency: string;
  region: string;
  search_keywords: string;
  is_active: number;
};

const DEFAULT_LIMIT = 20;

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function mapInstrumentRow(row: InstrumentRow): InstrumentDetail {
  return {
    symbol: row.symbol,
    nameEn: row.name_en,
    nameZh: row.name_zh,
    assetType: row.asset_type,
    issuer: row.issuer,
    currency: row.currency,
    region: row.region,
    searchKeywords: row.search_keywords,
    isActive: row.is_active === 1
  };
}

function toSearchResult(detail: InstrumentDetail): InstrumentSearchResult {
  return {
    symbol: detail.symbol,
    nameEn: detail.nameEn,
    nameZh: detail.nameZh,
    assetType: detail.assetType,
    issuer: detail.issuer,
    currency: detail.currency,
    region: detail.region,
    isActive: detail.isActive
  };
}

function inferAssetType(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("bond")) {
    return "bond etf";
  }
  if (normalized.includes("money market")) {
    return "money market etf";
  }
  return "equity etf";
}

function toSearchKeywords(input: InstrumentSearchResult): string {
  const parts = [
    input.symbol,
    input.nameEn,
    input.nameZh,
    input.assetType,
    input.issuer,
    input.region
  ];

  const deduped = new Set(
    parts
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item.length > 0)
  );
  return [...deduped].join(" ");
}

const upsertInstrumentFromSearchStmt = db.prepare(
  `
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
      @symbol,
      @nameEn,
      @nameZh,
      @assetType,
      @issuer,
      @currency,
      @region,
      @searchKeywords,
      1,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(symbol)
    DO UPDATE SET
      name_en = excluded.name_en,
      name_zh = CASE
        WHEN excluded.name_zh != '' THEN excluded.name_zh
        ELSE instruments.name_zh
      END,
      asset_type = excluded.asset_type,
      issuer = CASE
        WHEN excluded.issuer != '' THEN excluded.issuer
        ELSE instruments.issuer
      END,
      currency = excluded.currency,
      region = excluded.region,
      search_keywords = excluded.search_keywords,
      is_active = 1,
      updated_at = CURRENT_TIMESTAMP
  `
);

function persistSearchResults(results: InstrumentSearchResult[]): void {
  if (results.length === 0) {
    return;
  }

  const transaction = db.transaction((rows: InstrumentSearchResult[]) => {
    for (const row of rows) {
      upsertInstrumentFromSearchStmt.run({
        symbol: row.symbol,
        nameEn: row.nameEn,
        nameZh: row.nameZh,
        assetType: row.assetType || inferAssetType(row.nameEn),
        issuer: row.issuer,
        currency: row.currency || "HKD",
        region: row.region || "Hong Kong",
        searchKeywords: toSearchKeywords(row)
      });
    }
  });

  transaction(results);
}

export function getInstrumentBySymbol(symbol: string): InstrumentDetail | null {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return null;
  }

  const row = db
    .prepare(
      `
        SELECT
          symbol,
          name_en,
          name_zh,
          asset_type,
          issuer,
          currency,
          region,
          search_keywords,
          is_active
        FROM instruments
        WHERE symbol = ?
        LIMIT 1
      `
    )
    .get(normalized) as InstrumentRow | undefined;

  return row ? mapInstrumentRow(row) : null;
}

export function getInstrumentsBySymbols(symbols: string[]): Map<string, InstrumentDetail> {
  const uniqueSymbols = [...new Set(symbols.map(normalizeSymbol).filter((item) => item.length > 0))];
  if (uniqueSymbols.length === 0) {
    return new Map();
  }

  const placeholders = uniqueSymbols.map(() => "?").join(",");
  const rows = db
    .prepare(
      `
        SELECT
          symbol,
          name_en,
          name_zh,
          asset_type,
          issuer,
          currency,
          region,
          search_keywords,
          is_active
        FROM instruments
        WHERE symbol IN (${placeholders})
      `
    )
    .all(...uniqueSymbols) as InstrumentRow[];

  return new Map(rows.map((row) => {
    const mapped = mapInstrumentRow(row);
    return [mapped.symbol, mapped];
  }));
}

function searchInstrumentsLocal(query: string, limit = DEFAULT_LIMIT): InstrumentSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(limit, 50));
  const upper = trimmed.toUpperCase();
  const symbolPrefix = `${upper}%`;
  const symbolContains = `%${upper}%`;
  const textPrefix = `${trimmed}%`;
  const contains = `%${trimmed}%`;

  const rows = db
    .prepare(
      `
        SELECT
          symbol,
          name_en,
          name_zh,
          asset_type,
          issuer,
          currency,
          region,
          search_keywords,
          is_active
        FROM instruments
        WHERE is_active = 1
          AND (
            symbol LIKE @symbolPrefix
            OR symbol LIKE @symbolContains
            OR name_en LIKE @contains COLLATE NOCASE
            OR name_zh LIKE @contains
            OR search_keywords LIKE @contains COLLATE NOCASE
          )
        ORDER BY
          CASE
            WHEN symbol = @upper THEN 0
            WHEN symbol LIKE @symbolPrefix THEN 1
            WHEN name_en LIKE @textPrefix COLLATE NOCASE THEN 2
            WHEN name_zh LIKE @textPrefix THEN 3
            ELSE 4
          END,
          symbol ASC
        LIMIT @limit
      `
    )
    .all({
      upper,
      symbolPrefix,
      symbolContains,
      textPrefix,
      contains,
      limit: safeLimit
    }) as InstrumentRow[];

  return rows.map((row) => toSearchResult(mapInstrumentRow(row)));
}

export async function searchInstruments(input: {
  query: string;
  timeoutMs: number;
  limit?: number;
}): Promise<InstrumentSearchResult[]> {
  const safeLimit = Math.max(1, Math.min(input.limit ?? DEFAULT_LIMIT, 50));
  const query = input.query.trim();

  if (!query) {
    return [];
  }

  try {
    const liveResults = await searchHkexEtps({
      query,
      timeoutMs: input.timeoutMs,
      limit: safeLimit
    });

    if (liveResults.length > 0) {
      persistSearchResults(liveResults);
      return liveResults;
    }
  } catch (error) {
    console.warn(
      `[instrumentSearch] live HKEX search failed, using local catalog fallback: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }

  return searchInstrumentsLocal(query, safeLimit);
}
