import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import type { InstrumentSearchResult } from "@portfolio/shared";

const HKEX_QUOTE_PAGE =
  "https://www.hkex.com.hk/Market-Data/Securities-Prices/Exchange-Traded-Products/Exchange-Traded-Products-Quote?sc_lang=en";
const HKEX_SEARCH_ENDPOINT = "https://www1.hkex.com.hk/hkexwidget/data/getstocksearch";
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const FALLBACK_TOKEN =
  "evLtsLsBNAUVTPxtGqVeGx4vHgdwbAY1FBhdsZbSz99BAEQ4LbPtHhZm7g6cOcC5";

const SEARCH_HEADERS: IncomingHttpHeaders = {
  "User-Agent": "ETF-Portfolio/1.0 (+https://github.com/mixuanda/ETF-Portfolio)",
  Accept: "application/json, text/javascript, */*; q=0.1",
  "Accept-Encoding": "identity",
  Referer: HKEX_QUOTE_PAGE,
  Origin: "https://www.hkex.com.hk"
};

const KEYWORD_ALIASES: Record<string, string> = {
  "02006": "03417",
  "02006.HK": "03417",
  "2006": "3417",
  "2006.HK": "3417"
};

type HkexStockSearchPayload = {
  data?: {
    responsecode?: string;
    responsemsg?: string;
    stocklist?: Array<{
      sym?: string;
      nm?: string;
      type?: string;
    }>;
  };
};

type ParsedEntry = {
  symbol: string;
  nameEn: string;
  nameZh: string;
};

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

function parseJsonpPayload(body: string): HkexStockSearchPayload {
  const start = body.indexOf("(");
  const end = body.lastIndexOf(")");

  if (start < 0 || end <= start) {
    throw new Error("HKEX stock search returned unexpected JSONP payload");
  }

  return JSON.parse(body.slice(start + 1, end)) as HkexStockSearchPayload;
}

function normalizeSymbol(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase();
  if (!/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed.padStart(5, "0");
}

function normalizeKeyword(query: string): string {
  const trimmed = query.trim().toUpperCase();
  if (!trimmed) {
    return trimmed;
  }
  return KEYWORD_ALIASES[trimmed] ?? trimmed;
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
        "User-Agent": String(SEARCH_HEADERS["User-Agent"]),
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

async function fetchByLanguage(input: {
  keyword: string;
  lang: "eng" | "chi";
  token: string;
  timeoutMs: number;
}): Promise<Array<{ symbol: string; name: string }>> {
  const callback = `jQuery${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  const query = new URLSearchParams({
    lang: input.lang,
    token: input.token,
    pre: "50",
    keyword: input.keyword,
    callback,
    qid: String(Date.now())
  });

  const response = await requestText({
    url: `${HKEX_SEARCH_ENDPOINT}?${query.toString()}`,
    timeoutMs: input.timeoutMs,
    headers: SEARCH_HEADERS
  });

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`HKEX stock search failed with HTTP ${response.statusCode}`);
  }

  const payload = parseJsonpPayload(response.body);
  const responseCode = payload.data?.responsecode;
  if (responseCode !== "000") {
    throw new Error(
      `HKEX stock search unavailable (${responseCode ?? "unknown"}: ${payload.data?.responsemsg ?? "no detail"})`
    );
  }

  const list = payload.data?.stocklist ?? [];
  return list
    .filter((item) => item.type === "ETP" && item.sym && item.nm)
    .map((item) => ({
      symbol: normalizeSymbol(String(item.sym)),
      name: String(item.nm).trim()
    }))
    .filter((item) => item.symbol.length > 0 && item.name.length > 0);
}

function mergeBySymbol(
  englishRows: Array<{ symbol: string; name: string }>,
  chineseRows: Array<{ symbol: string; name: string }>
): ParsedEntry[] {
  const merged = new Map<string, ParsedEntry>();

  for (const row of englishRows) {
    merged.set(row.symbol, {
      symbol: row.symbol,
      nameEn: row.name,
      nameZh: ""
    });
  }

  for (const row of chineseRows) {
    const existing = merged.get(row.symbol);
    if (existing) {
      existing.nameZh = row.name;
      continue;
    }
    merged.set(row.symbol, {
      symbol: row.symbol,
      nameEn: row.name,
      nameZh: row.name
    });
  }

  return [...merged.values()];
}

export async function searchHkexEtps(input: {
  query: string;
  timeoutMs: number;
  limit: number;
}): Promise<InstrumentSearchResult[]> {
  const keyword = normalizeKeyword(input.query);
  if (!keyword) {
    return [];
  }

  const token = await fetchToken(input.timeoutMs);
  const [englishRows, chineseRows] = await Promise.all([
    fetchByLanguage({
      keyword,
      lang: "eng",
      token,
      timeoutMs: input.timeoutMs
    }),
    fetchByLanguage({
      keyword,
      lang: "chi",
      token,
      timeoutMs: input.timeoutMs
    })
  ]);

  const merged = mergeBySymbol(englishRows, chineseRows);

  return merged.slice(0, input.limit).map((item) => ({
    symbol: item.symbol,
    nameEn: item.nameEn,
    nameZh: item.nameZh,
    assetType: "equity etf",
    issuer: "",
    currency: "HKD",
    region: "Hong Kong",
    isActive: true
  }));
}
