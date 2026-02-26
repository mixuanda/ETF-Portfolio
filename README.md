# Hong Kong ETF personal portfolio dashboard

This project is a personal-use portfolio dashboard for Hong Kong ETFs and a
small set of manually tracked products. It is a read-only market data app with
manual refresh. It is not a trading platform.

## What this app does

The app stores your data locally in SQLite and refreshes delayed quotes only
when you click **Refresh Prices**.

- Tracks HK ETF holdings and manual products.
- Stores delayed quote snapshots in `asset_snapshots`.
- Tracks dividend history and includes dividends in total return.
- Shows dashboard, holdings, dividends, analysis, and settings pages.
- Exposes quote source and refresh status in the UI.

## Real mode vs demo mode

The app has two explicit modes. Normal use is real mode.

- **Real mode (default):** Yahoo delayed quotes only.
- **Demo mode (opt-in):** demo provider can be selected for testing.

Important safety behavior:

- Demo prices are never used silently in real mode.
- Demo fallback is disabled by default.
- If quote refresh fails, cached snapshots are preserved.
- Failed symbols are reported; missing symbols are never fabricated.

## Quick start

Follow these steps to run locally.

1. Install dependencies.

   ```bash
   npm install
   ```

2. Initialize schema only (no demo portfolio data).

   ```bash
   npm run db:init
   ```

3. Start backend and frontend in dev mode.

   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173`.

Backend runs on `http://localhost:4000`.

## Scripts

Use these scripts from the repository root.

- `npm run dev`: build shared package, then run shared watcher, backend, and
  frontend.
- `npm run build`: build shared, backend, and frontend.
- `npm run db:init`: initialize schema only.
- `npm run db:seed`: apply demo seed data intentionally.

## Environment variables

Copy `.env.example` to `.env` and adjust as needed.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | Backend API port |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS origin for frontend |
| `DB_PATH` | `database/portfolio.db` | SQLite file path override |
| `DEFAULT_QUOTE_PROVIDER` | `yahoo` | Default provider (`yahoo` or `demo`) |
| `ENABLE_DEMO_MODE` | `false` | Enables explicit demo/testing mode |
| `ALLOW_DEMO_FALLBACK` | `false` | Allows Yahoo to fall back to demo only when demo mode is enabled |

## Manual refresh behavior

The refresh flow is manual and cache-preserving.

1. You open the site.
2. The frontend shows cached snapshot data.
3. You click **Refresh Prices**.
4. Backend fetches delayed quotes from provider.
5. On success, new real quotes are persisted.
6. On failure, existing cached snapshots remain unchanged.

Refresh status is shown as `idle`, `refreshing`, `success`, or `failed`.
Dashboard and holdings pages display:

- Last updated timestamp.
- Last successful source/provider.
- Cached-data state.
- Failure warning when refresh does not complete.

## Seeding behavior

Demo seed data exists for testing but is never loaded automatically in normal
startup.

- `npm run db:init` does not seed holdings or quote snapshots.
- `npm run db:seed` intentionally loads demo holdings, snapshots, and dividends.

Demo seed includes sample HK ETF symbols:

- `03010`
- `03153`
- `03195`
- `03421`
- `03450`
- `03466`

## Quote provider architecture

Quote fetching is abstracted behind a service layer.

- Interface: `backend/src/services/quotes/QuoteProvider.ts`
- Coordinator: `backend/src/services/quotes/QuoteService.ts`
- Provider selector: `backend/src/services/quotes/createQuoteService.ts`
- Yahoo implementation: `backend/src/services/quotes/providers/YahooQuoteProvider.ts`
- Demo implementation: `backend/src/services/quotes/providers/DemoQuoteProvider.ts`

To add another provider, implement `QuoteProvider` and register it in
`createQuoteService.ts`.

## Yahoo provider note

Yahoo is used as an unofficial delayed quote source. It can occasionally fail,
timeout, or rate-limit. When this happens, the app keeps the last cached data
and surfaces a warning instead of writing fabricated prices.

## SQLite schema

`database/schema.sql` defines:

- `holdings`
- `manual_assets`
- `asset_snapshots`
- `dividends`
- `settings`

## API endpoints

Core endpoints:

- `GET /api/portfolio`
- `GET /api/holdings`
- `POST /api/refresh`
- `GET /api/dividends`
- `POST /api/holdings`
- `PATCH /api/holdings/:id`
- `DELETE /api/holdings/:id`

Additional UI endpoints:

- `GET /api/manual-assets`
- `POST /api/manual-assets`
- `PATCH /api/manual-assets/:id`
- `DELETE /api/manual-assets/:id`
- `POST /api/dividends`
- `PATCH /api/dividends/:id`
- `DELETE /api/dividends/:id`
- `GET /api/settings`
- `PATCH /api/settings`
