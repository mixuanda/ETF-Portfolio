import { initializeDatabase } from "../backend/src/db/bootstrap.js";

type AppHandler = (req: unknown, res: unknown) => unknown;

let appPromise: Promise<AppHandler> | null = null;

async function loadApp(): Promise<AppHandler> {
  if (!appPromise) {
    initializeDatabase();
    appPromise = import("../backend/src/app.js").then((module) => module.default as AppHandler);
  }

  return appPromise;
}

export default async function handler(req: unknown, res: unknown): Promise<unknown> {
  const app = await loadApp();
  return app(req, res);
}
