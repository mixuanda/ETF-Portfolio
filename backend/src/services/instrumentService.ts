import type { InstrumentDetail, InstrumentSearchResult } from "@portfolio/shared";
import db from "../db/client.js";

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

export function searchInstruments(query: string, limit = DEFAULT_LIMIT): InstrumentSearchResult[] {
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
