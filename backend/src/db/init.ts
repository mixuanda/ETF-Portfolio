import { initializeDatabase } from "./bootstrap.js";

const forceSeed = process.argv.includes("--seed");
const result = initializeDatabase({ seedIfEmpty: true, forceSeed });

if (result.seeded) {
  console.log("Database initialized and seed data applied.");
} else {
  console.log("Database initialized. Seed data already present.");
}
