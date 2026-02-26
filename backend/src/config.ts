import path from "node:path";
import fs from "node:fs";
import "dotenv/config";

function resolveDbPath(rawPath?: string): string {
  if (rawPath) {
    return path.resolve(process.cwd(), rawPath);
  }

  const fromWorkspaceRoot = path.resolve(process.cwd(), "database", "portfolio.db");
  const fromBackendDir = path.resolve(process.cwd(), "..", "database", "portfolio.db");

  if (fs.existsSync(path.dirname(fromWorkspaceRoot))) {
    return fromWorkspaceRoot;
  }

  return fromBackendDir;
}

function toNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return fallback;
}

function toProvider(value: string | undefined): "yahoo" | "demo" {
  return value?.trim().toLowerCase() === "demo" ? "demo" : "yahoo";
}

export const config = {
  port: toNumber(process.env.PORT, 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  dbPath: resolveDbPath(process.env.DB_PATH),
  defaultQuoteProvider: toProvider(process.env.DEFAULT_QUOTE_PROVIDER),
  enableDemoMode: toBoolean(process.env.ENABLE_DEMO_MODE, false),
  allowDemoFallback: toBoolean(process.env.ALLOW_DEMO_FALLBACK, false)
} as const;
