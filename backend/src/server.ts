import app from "./app.js";
import { config } from "./config.js";
import { initializeDatabase } from "./db/bootstrap.js";

initializeDatabase({ seedIfEmpty: true });

app.listen(config.port, () => {
  console.log(`Backend API running at http://localhost:${config.port}`);
});
