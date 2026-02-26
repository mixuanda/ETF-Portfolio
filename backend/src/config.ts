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

export const config = {
  port: toNumber(process.env.PORT, 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  dbPath: resolveDbPath(process.env.DB_PATH),
  defaultQuoteProvider: process.env.DEFAULT_QUOTE_PROVIDER ?? "yahoo"
} as const;
