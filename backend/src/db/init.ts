import { initializeDatabase } from "./bootstrap.js";

const seed = process.argv.includes("--seed");
const result = initializeDatabase({ seed });

if (result.seeded) {
  console.log("Database initialized and seed data applied.");
} else {
  console.log("Database initialized without demo seed data.");
}
