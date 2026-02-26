import { config } from "./config.js";
import { initializeDatabase } from "./db/bootstrap.js";

initializeDatabase();

const { default: app } = await import("./app.js");

app.listen(config.port, () => {
  console.log(`Backend API running at http://localhost:${config.port}`);
});
