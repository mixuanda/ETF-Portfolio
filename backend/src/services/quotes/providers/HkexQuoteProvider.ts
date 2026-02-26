import type { QuoteData, QuoteError } from "@portfolio/shared";
import https from "node:https";
import type { IncomingHttpHeaders } from "node:http";
import type { QuoteProvider, QuoteProviderResult } from "../QuoteProvider.js";
import { normalizeForHkex } from "../symbolNormalization.js";

const HKEX_QUOTE_PAGE =
  "https://www.hkex.com.hk/Market-Data/Securities-Prices/Exchange-Traded-Products/Exchange-Traded-Products-Quote?sc_lang=en";
const HKEX_WIDGET_ENDPOINT = "https://www1.hkex.com.hk/hkexwidget/data/getequityquote";
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
const FALLBACK_TOKEN =
  "evLtsLsBNAUVTPxtGqVeGx4vHgdwbAY1FBhdsZbSz99BAEQ4LbPtHhZm7g6cOcC5";

const REQUEST_HEADERS = {
  "User-Agent": "ETF-Portfolio/1.0 (+https://github.com/mixuanda/ETF-Portfolio)",
  Accept: "application/json, text/javascript, */*; q=0.1",
  "Accept-Encoding": "identity",
  Referer: HKEX_QUOTE_PAGE,
  Origin: "https://www.hkex.com.hk"
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

type HkexPayload = {
  data?: {
    responsecode?: string;
    responsemsg?: string;
    quote?: {
      sym?: string;
      ls?: string;
      nc?: string;
      pc?: string;
      ccy?: string;
      update_time?: string;
      updatetime?: string;
    };
  };
};

function parseNumber(raw: string | number | undefined | null): number | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }

  const normalized = raw.replace(/,/g, "").replace(/%/g, "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseQuoteTime(primary: string | undefined, secondary: string | undefined): string {
  const candidates = [primary, secondary].filter((item): item is string => Boolean(item));

  for (const value of candidates) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date().toISOString();
}

function parseJsonpPayload(body: string): HkexPayload {
  const start = body.indexOf("(");
  const end = body.lastIndexOf(")");
  if (start < 0 || end <= start) {
    throw new Error("HKEX returned an unexpected JSONP payload.");
  }

  const json = body.slice(start + 1, end);
  return JSON.parse(json) as HkexPayload;
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
        "User-Agent": REQUEST_HEADERS["User-Agent"],
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
      throw new Error("Token script block not found on HKEX quote page");
    }

    cachedToken = {
      value: token,
      expiresAt: Date.now() + TOKEN_TTL_MS
    };

    return token;
  } catch (error) {
    console.warn(
      `[HKEXQuoteProvider] token fetch failed, using fallback token: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
    cachedToken = {
      value: FALLBACK_TOKEN,
      expiresAt: Date.now() + Math.min(TOKEN_TTL_MS, 30 * 60 * 1000)
    };
    return FALLBACK_TOKEN;
  }
}

export class HkexQuoteProvider implements QuoteProvider {
  readonly name = "hkex";

  constructor(private readonly timeoutMs: number) {}

  private async fetchSingle(symbol: string, token: string): Promise<{ quote?: QuoteData; error?: QuoteError }> {
    const normalized = normalizeForHkex(symbol);
    const callbackName = `jQuery${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

    const query = new URLSearchParams({
      sym: normalized,
      token,
      lang: "eng",
      callback: callbackName,
      qid: String(Date.now())
    });

    try {
      const response = await requestText({
        url: `${HKEX_WIDGET_ENDPOINT}?${query.toString()}`,
        timeoutMs: this.timeoutMs,
        headers: REQUEST_HEADERS
      });

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return {
          error: {
            symbol,
            message: `HKEX request failed with HTTP ${response.statusCode}`
          }
        };
      }

      const body = response.body;
      const payload = parseJsonpPayload(body);
      const responseCode = payload.data?.responsecode;

      if (responseCode !== "000") {
        return {
          error: {
            symbol,
            message: `HKEX quote unavailable (${responseCode ?? "unknown response code"})`
          }
        };
      }

      const quote = payload.data?.quote;
      const price = parseNumber(quote?.ls);

      if (price == null) {
        return {
          error: {
            symbol,
            message: "HKEX quote payload did not include a valid last price"
          }
        };
      }

      return {
        quote: {
          symbol,
          price,
          changeAmount: parseNumber(quote?.nc),
          changePercent: parseNumber(quote?.pc),
          currency: quote?.ccy ?? "HKD",
          asOf: parseQuoteTime(quote?.update_time, quote?.updatetime),
          provider: this.name,
          status: "success"
        }
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          error: {
            symbol,
            message: `HKEX quote request timed out after ${this.timeoutMs}ms`
          }
        };
      }

      return {
        error: {
          symbol,
          message:
            error instanceof Error && error.message.includes("timed out")
              ? `HKEX quote request timed out after ${this.timeoutMs}ms`
              : `HKEX quote request failed: ${error instanceof Error ? error.message : "unexpected error"}`
        }
      };
    }
  }

  async fetchQuotes(symbols: string[]): Promise<QuoteProviderResult> {
    if (symbols.length === 0) {
      return { quotes: [], errors: [] };
    }

    const token = await fetchToken(this.timeoutMs);
    const results = await Promise.all(symbols.map((symbol) => this.fetchSingle(symbol, token)));

    const quotes: QuoteData[] = [];
    const errors: QuoteError[] = [];

    for (const item of results) {
      if (item.quote) {
        quotes.push(item.quote);
      }
      if (item.error) {
        errors.push(item.error);
      }
    }

    return { quotes, errors };
  }
}
