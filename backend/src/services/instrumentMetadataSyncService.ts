import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import db from "../db/client.js";
import { normalizeForHkex } from "./quotes/symbolNormalization.js";

const HKEX_QUOTE_PAGE =
  "https://www.hkex.com.hk/Market-Data/Securities-Prices/Exchange-Traded-Products/Exchange-Traded-Products-Quote?sc_lang=en";
const HKEX_WIDGET_ENDPOINT = "https://www1.hkex.com.hk/hkexwidget/data/getequityquote";
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const FALLBACK_TOKEN =
  "evLtsLsBNAUVTPxtGqVeGx4vHgdwbAY1FBhdsZbSz99BAEQ4LbPtHhZm7g6cOcC5";

const REQUEST_HEADERS: IncomingHttpHeaders = {
  "User-Agent": "ETF-Portfolio/1.0 (+https://github.com/mixuanda/ETF-Portfolio)",
  Accept: "application/json, text/javascript, */*; q=0.1",
  "Accept-Encoding": "identity",
  Referer: HKEX_QUOTE_PAGE,
  Origin: "https://www.hkex.com.hk"
};

type HkexPayload = {
  data?: {
    responsecode?: string;
    responsemsg?: string;
    quote?: {
      nm?: string;
      issuer_name?: string;
      ccy?: string;
      etp_baseCur?: string;
      asset_class?: string;
    };
  };
};

export interface InstrumentSyncResult {
  syncedAt: string;
  updatedSymbols: string[];
  failedSymbols: Array<{
    symbol: string;
    message: string;
  }>;
}

function requestText(input: {
  url: string;
  timeoutMs: number;
  headers?: IncomingHttpHeaders;
}): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      input.url,
      {
        method: "GET",
        headers: input.headers
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on("end", () => {
          resolve({
            statusCode,
            body: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );

    request.setTimeout(input.timeoutMs, () => {
      request.destroy(new Error(`Request timed out after ${input.timeoutMs}ms`));
    });

    request.on("error", (error) => {
      reject(error);
    });

    request.end();
  });
}

function parseJsonpPayload(body: string): HkexPayload {
  const start = body.indexOf("(");
  const end = body.lastIndexOf(")");
  if (start < 0 || end <= start) {
    throw new Error("HKEX returned unexpected JSONP payload");
  }
  return JSON.parse(body.slice(start + 1, end)) as HkexPayload;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function fetchToken(timeoutMs: number): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  try {
    const response = await requestText({
      url: HKEX_QUOTE_PAGE,
      timeoutMs,
      headers: {
        "User-Agent": String(REQUEST_HEADERS["User-Agent"]),
        Accept: "text/html",
        "Accept-Encoding": "identity"
      }
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`HTTP ${response.statusCode}`);
    }

    const html = response.body;
    const functionBlock = html.match(/LabCI\.getToken\s*=\s*function\s*\(\)\s*\{([\s\S]*?)\};/);
    const executableBody = functionBlock?.[1]?.replace(/\/\/.*$/gm, "") ?? "";
    const match = executableBody.match(/return\s+"([^"]+)"/);
    const rawToken = match?.[1]?.trim();
    const token = rawToken ? decodeURIComponent(rawToken) : null;

    if (!token) {
      throw new Error("Token not found in HKEX quote page");
    }

    cachedToken = {
      value: token,
      expiresAt: Date.now() + TOKEN_TTL_MS
    };

    return token;
  } catch {
    cachedToken = {
      value: FALLBACK_TOKEN,
      expiresAt: Date.now() + Math.min(TOKEN_TTL_MS, 30 * 60 * 1000)
    };
    return FALLBACK_TOKEN;
  }
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function inferAssetType(input: {
  existing: string | null;
  assetClassEng: string | undefined;
}): string {
  const source = (input.assetClassEng ?? "").toLowerCase();
  if (source.includes("bond")) {
    return "bond etf";
  }
  if (source.includes("money")) {
    return "money market etf";
  }
  if (source.includes("equity") || source.includes("stock")) {
    return "equity etf";
  }
  return input.existing ?? "etf";
}

function buildKeywords(parts: Array<string | undefined | null>): string {
  const deduped = new Set(
    parts
      .map((item) => (item ?? "").trim().toLowerCase())
      .filter((item) => item.length > 0)
  );
  return [...deduped].join(" ");
}

async function fetchMetadataByLanguage(input: {
  symbol: string;
  token: string;
  lang: "eng" | "chi";
  timeoutMs: number;
}): Promise<{
  name: string;
  issuer: string;
  currency: string;
  assetClass: string;
}> {
  const callback = `jQuery${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  const query = new URLSearchParams({
    sym: normalizeForHkex(input.symbol),
    token: input.token,
    lang: input.lang,
    callback,
    qid: String(Date.now())
  });

  const response = await requestText({
    url: `${HKEX_WIDGET_ENDPOINT}?${query.toString()}`,
    timeoutMs: input.timeoutMs,
    headers: REQUEST_HEADERS
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`HKEX metadata request failed with HTTP ${response.statusCode}`);
  }

  const payload = parseJsonpPayload(response.body);
  const responseCode = payload.data?.responsecode;
  if (responseCode !== "000") {
    throw new Error(
      `HKEX metadata unavailable (${responseCode ?? "unknown"}: ${payload.data?.responsemsg ?? "no detail"})`
    );
  }

  const quote = payload.data?.quote;
  const name = (quote?.nm ?? "").trim();
  const issuer = (quote?.issuer_name ?? "").trim();
  const currency = (quote?.ccy ?? quote?.etp_baseCur ?? "HKD").trim() || "HKD";
  const assetClass = (quote?.asset_class ?? "").trim();

  if (!name) {
    throw new Error("HKEX metadata payload missing instrument name");
  }

  return {
    name,
    issuer,
    currency,
    assetClass
  };
}

type ExistingInstrumentRow = {
  asset_type: string;
  region: string;
};

function getExistingInstrument(symbol: string): ExistingInstrumentRow | null {
  const row = db
    .prepare(
      `
        SELECT asset_type, region
        FROM instruments
        WHERE symbol = ?
        LIMIT 1
      `
    )
    .get(symbol) as ExistingInstrumentRow | undefined;
  return row ?? null;
}

const upsertInstrumentStmt = db.prepare(
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

const upsertInactiveInstrumentStmt = db.prepare(
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
      '',
      @assetType,
      '',
      'HKD',
      'Hong Kong',
      @searchKeywords,
      0,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(symbol)
    DO UPDATE SET
      is_active = 0,
      updated_at = CURRENT_TIMESTAMP
  `
);

const updateHoldingStmt = db.prepare(
  `
    UPDATE holdings
    SET name = @nameEn,
        asset_type = @assetType,
        currency = @currency,
        updated_at = CURRENT_TIMESTAMP
    WHERE symbol = @symbol
  `
);

const listTrackedSymbolsStmt = db.prepare(
  `
    SELECT symbol
    FROM instruments
    WHERE is_active = 1
    UNION
    SELECT symbol
    FROM holdings
    WHERE quantity > 0
    UNION
    SELECT symbol
    FROM watchlist
    ORDER BY symbol ASC
  `
);

export async function syncInstrumentMetadata(input: {
  symbols: string[];
  timeoutMs: number;
}): Promise<InstrumentSyncResult> {
  const uniqueSymbols = [...new Set(input.symbols.map(normalizeSymbol).filter((item) => item.length > 0))];

  if (uniqueSymbols.length === 0) {
    return {
      syncedAt: new Date().toISOString(),
      updatedSymbols: [],
      failedSymbols: []
    };
  }

  const token = await fetchToken(input.timeoutMs);
  const updatedSymbols: string[] = [];
  const failedSymbols: Array<{ symbol: string; message: string }> = [];

  for (const symbol of uniqueSymbols) {
    try {
      const [eng, chi] = await Promise.all([
        fetchMetadataByLanguage({
          symbol,
          token,
          lang: "eng",
          timeoutMs: input.timeoutMs
        }),
        fetchMetadataByLanguage({
          symbol,
          token,
          lang: "chi",
          timeoutMs: input.timeoutMs
        })
      ]);

      const existing = getExistingInstrument(symbol);
      const nameEn = eng.name;
      const nameZh = chi.name && chi.name !== eng.name ? chi.name : "";
      const issuer = eng.issuer;
      const currency = eng.currency || "HKD";
      const assetType = inferAssetType({
        existing: existing?.asset_type ?? null,
        assetClassEng: eng.assetClass
      });
      const region = existing?.region ?? "Hong Kong";
      const searchKeywords = buildKeywords([symbol, nameEn, nameZh, issuer, assetType]);

      const transaction = db.transaction(() => {
        upsertInstrumentStmt.run({
          symbol,
          nameEn,
          nameZh,
          assetType,
          issuer,
          currency,
          region,
          searchKeywords
        });

        updateHoldingStmt.run({
          symbol,
          nameEn,
          assetType,
          currency
        });
      });

      transaction();
      updatedSymbols.push(symbol);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown metadata sync error";

      if (message.includes("(002") || message.toLowerCase().includes("invalid input")) {
        upsertInactiveInstrumentStmt.run({
          symbol,
          nameEn: symbol,
          assetType: "etf",
          searchKeywords: buildKeywords([symbol])
        });
      }

      failedSymbols.push({
        symbol,
        message
      });
    }
  }

  return {
    syncedAt: new Date().toISOString(),
    updatedSymbols,
    failedSymbols
  };
}

export async function syncTrackedInstrumentMetadata(timeoutMs: number): Promise<InstrumentSyncResult> {
  const rows = listTrackedSymbolsStmt.all() as Array<{ symbol: string }>;
  return syncInstrumentMetadata({
    symbols: rows.map((row) => row.symbol),
    timeoutMs
  });
}
