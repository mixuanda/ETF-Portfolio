import type {
  QuoteProviderName,
  RefreshStatus,
  SettingsResponse
} from "@portfolio/shared";
import db from "../db/client.js";

type SettingsKey =
  | "quote_provider"
  | "refresh_timeout_ms"
  | "refresh_retries"
  | "custom_tags"
  | "base_currency"
  | "last_refresh_status"
  | "last_refresh_at"
  | "last_refresh_error";

const DEFAULT_SETTINGS: SettingsResponse = {
  quoteProvider: "yahoo",
  refreshTimeoutMs: 6000,
  refreshRetries: 1,
  customTags: ["equity", "bond", "money market", "dividend", "defensive"],
  baseCurrency: "HKD",
  lastRefreshStatus: "idle",
  lastRefreshAt: null,
  lastRefreshError: null
};

function getRawSettingsMap(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;

  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseRefreshStatus(value: string | undefined): RefreshStatus {
  if (value === "idle" || value === "refreshing" || value === "success" || value === "failed") {
    return value;
  }
  return "idle";
}

function parseQuoteProvider(value: string | undefined): QuoteProviderName {
  return value === "demo" ? "demo" : "yahoo";
}

function parseTags(value: string | undefined): string[] {
  if (!value) {
    return DEFAULT_SETTINGS.customTags;
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return DEFAULT_SETTINGS.customTags;
    }
    return parsed.map((item) => String(item).trim()).filter((item) => item.length > 0);
  } catch {
    return DEFAULT_SETTINGS.customTags;
  }
}

const upsertSettingStmt = db.prepare(
  `
    INSERT INTO settings (key, value, updated_at)
    VALUES (@key, @value, CURRENT_TIMESTAMP)
    ON CONFLICT(key)
    DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `
);

export function getSettings(): SettingsResponse {
  const raw = getRawSettingsMap();

  const lastRefreshAt = raw.last_refresh_at?.trim() ? raw.last_refresh_at : null;
  const lastRefreshError = raw.last_refresh_error?.trim() ? raw.last_refresh_error : null;

  return {
    quoteProvider: parseQuoteProvider(raw.quote_provider),
    refreshTimeoutMs: parseNumber(raw.refresh_timeout_ms, DEFAULT_SETTINGS.refreshTimeoutMs),
    refreshRetries: parseNumber(raw.refresh_retries, DEFAULT_SETTINGS.refreshRetries),
    customTags: parseTags(raw.custom_tags),
    baseCurrency: raw.base_currency ?? DEFAULT_SETTINGS.baseCurrency,
    lastRefreshStatus: parseRefreshStatus(raw.last_refresh_status),
    lastRefreshAt,
    lastRefreshError
  };
}

export function updateSettings(input: {
  quoteProvider?: QuoteProviderName;
  refreshTimeoutMs?: number;
  refreshRetries?: number;
  customTags?: string[];
  baseCurrency?: string;
}): SettingsResponse {
  const writes: Array<{ key: SettingsKey; value: string }> = [];

  if (input.quoteProvider) {
    writes.push({ key: "quote_provider", value: input.quoteProvider });
  }
  if (input.refreshTimeoutMs != null) {
    writes.push({ key: "refresh_timeout_ms", value: String(input.refreshTimeoutMs) });
  }
  if (input.refreshRetries != null) {
    writes.push({ key: "refresh_retries", value: String(input.refreshRetries) });
  }
  if (input.customTags) {
    writes.push({ key: "custom_tags", value: JSON.stringify(input.customTags) });
  }
  if (input.baseCurrency) {
    writes.push({ key: "base_currency", value: input.baseCurrency });
  }

  const transaction = db.transaction((entries: Array<{ key: SettingsKey; value: string }>) => {
    for (const entry of entries) {
      upsertSettingStmt.run(entry);
    }
  });

  transaction(writes);
  return getSettings();
}

export function setRefreshState(input: {
  status: RefreshStatus;
  refreshedAt?: string | null;
  error?: string | null;
}): void {
  const writes: Array<{ key: SettingsKey; value: string }> = [
    { key: "last_refresh_status", value: input.status }
  ];

  if (input.refreshedAt !== undefined) {
    writes.push({ key: "last_refresh_at", value: input.refreshedAt ?? "" });
  }
  if (input.error !== undefined) {
    writes.push({ key: "last_refresh_error", value: input.error ?? "" });
  }

  const transaction = db.transaction((entries: Array<{ key: SettingsKey; value: string }>) => {
    for (const entry of entries) {
      upsertSettingStmt.run(entry);
    }
  });

  transaction(writes);
}
