import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, "..", "..");
const rootDir = path.resolve(backendDir, "..");

const schemaPath = path.resolve(rootDir, "database", "schema.sql");
const seedPath = path.resolve(rootDir, "database", "seed.sql");

function runSqlFile(filePath: string): void {
  const sql = fs.readFileSync(filePath, "utf8");
  db.exec(sql);
}

export function initializeDatabase(options?: { seed?: boolean }): {
  seeded: boolean;
} {
  runSqlFile(schemaPath);

  let seeded = false;
  const shouldSeed = Boolean(options?.seed);

  if (shouldSeed) {
    runSqlFile(seedPath);
    seeded = true;
  }

  return { seeded };
}
