type AppHandler = (req: unknown, res: unknown) => unknown;

let appPromise: Promise<AppHandler> | null = null;

async function loadApp(): Promise<AppHandler> {
  if (!appPromise) {
    appPromise = (async () => {
      const bootstrapModule = await import("../backend/src/db/bootstrap.js");
      bootstrapModule.initializeDatabase();

      const appModule = await import("../backend/src/app.js");
      return appModule.default as AppHandler;
    })();
  }

  return appPromise;
}

export default async function handler(req: unknown, res: unknown): Promise<unknown> {
  const app = await loadApp();
  return app(req, res);
}
