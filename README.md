# Hong Kong ETF personal portfolio dashboard

This project is a personal-use portfolio dashboard for Hong Kong ETFs and a
small set of manually tracked products. It is a read-only market data app with
manual refresh. It is not a trading platform.

## What this app does

The app stores your data locally in SQLite and refreshes delayed quotes only
when you click **Refresh Prices**.

- Tracks HK ETF holdings and manual products.
- Uses a search-first ETF add flow from a local instrument catalog.
- Uses HKEX live search (`getstocksearch`) for ETF lookup, then caches results locally.
- Supports tracked-only watchlist symbols (not yet purchased).
- Records BUY/SELL transactions and keeps holdings as a summary layer.
- Optional Firebase program sync for selected symbols and purchase items.
- Stores delayed quote snapshots in `asset_snapshots`.
- Tracks dividend history and includes dividends in total return.
- Shows dashboard, holdings, dividends, analysis, and settings pages.
- Exposes quote source and refresh status in the UI.

## Real mode vs demo mode

The app has two explicit modes. Normal use is real mode.

- **Real mode (default):** Yahoo delayed quotes first, then HKEX delayed quote
  backup for failed symbols.
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

## Holdings workflow (search-first)

The Holdings page now uses a short search-first flow instead of the old large
manual ETF form.

Default add path:

1. Search an ETF by code or name (English or Chinese, when available).
2. Select instrument from results.
3. Choose whether it is already bought.
4. If bought: enter quantity + buy price (+ optional trade date/note).
5. If not bought: save to watchlist/tracked-only section.

You can later add more BUY/SELL trades for the same symbol from the purchased
holdings section using **Add transaction**.

## Data model direction

The backend now includes transaction-ready tables while keeping compatibility
with the current holdings display.

- `transactions` stores trade events (`BUY` / `SELL`).
- `watchlist` stores tracked instruments with no purchased position yet.
- `holdings` remains a per-symbol summary layer for current UI compatibility.

Long term, transaction records are intended to be the main source of truth for
portfolio position history.

## Deploy on Vercel

This repository includes `vercel.json` and an API bridge at `api/index.ts`, so
you can deploy frontend and backend in one Vercel project.

1. Connect `mixuanda/ETF-Portfolio` in Vercel.
2. Keep project root at repository root.
3. Set these environment variables in Vercel project settings:
   - `DEFAULT_QUOTE_PROVIDER=yahoo`
   - `ENABLE_HKEX_BACKUP=true`
   - `REQUEST_TIMEOUT_MS=8000`
   - `ENABLE_DEMO_MODE=false`
   - `ALLOW_DEMO_FALLBACK=false`
4. Deploy to Production.

Important Vercel persistence note:

- On Vercel serverless runtime, SQLite uses `/tmp/portfolio.db` by default.
- `/tmp` is ephemeral, so data can reset between cold starts or deployments.
- For durable hosted usage, move storage to a persistent managed database.

## Scripts

Use these scripts from the repository root.

- `npm run dev`: build shared package, then run shared watcher, backend, and
  frontend.
- `npm run build`: build shared, backend, and frontend.
- `npm run db:init`: initialize schema only.
- `npm run db:seed`: apply demo seed data intentionally.
- `npm run firebase:sync`: push selected symbols and purchases to Firestore.

## Environment variables

Copy `.env.example` to `.env` and adjust as needed.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | Backend API port |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS origin for frontend |
| `DB_PATH` | `database/portfolio.db` | SQLite file path override |
| `DEFAULT_QUOTE_PROVIDER` | `yahoo` | Default provider (`yahoo` or `demo`) |
| `REQUEST_TIMEOUT_MS` | `8000` | Provider request timeout in milliseconds |
| `ENABLE_HKEX_BACKUP` | `true` | Enables HKEX delayed quote backup when Yahoo fails |
| `ENABLE_DEMO_MODE` | `false` | Enables explicit demo/testing mode |
| `ALLOW_DEMO_FALLBACK` | `false` | Allows Yahoo to fall back to demo only when demo mode is enabled |
| `FIREBASE_ENABLED` | `false` | Enables Firebase Firestore sync program |
| `FIREBASE_PROJECT_ID` | empty | Firebase project id |
| `FIREBASE_CLIENT_EMAIL` | empty | Firebase service account client email |
| `FIREBASE_PRIVATE_KEY` | empty | Firebase service account private key (use `\\n` line breaks) |
| `FIREBASE_PORTFOLIO_ID` | `default` | Firestore portfolio document id |
| `FIREBASE_RESTORE_ON_BOOT` | `true` | Restores cloud snapshot into local DB when local DB is empty |

## Manual refresh behavior

The refresh flow is manual and cache-preserving.

1. You open the site.
2. The frontend shows cached snapshot data.
3. You click **Refresh Prices**.
4. Backend fetches delayed quotes from Yahoo first.
5. If Yahoo fails for a symbol and HKEX backup is enabled, backend retries that
   symbol via HKEX delayed quote endpoint.
6. During refresh, tracked symbol metadata (name/issuer) is also synced from
   HKEX to keep symbol-name mapping aligned with public market data.
7. On success, only successful real quotes are persisted.
8. On failure, existing cached snapshots remain unchanged.

Refresh status is shown as `idle`, `refreshing`, `success`,
`partial_success`, or `failed`.
Dashboard and holdings pages display:

- Last updated timestamp.
- Last successful source/provider.
- Provider used for each refreshed symbol.
- Cached-data state.
- Failure warning when refresh does not complete.

## Seeding behavior

Demo seed data exists for testing but is never loaded automatically in normal
startup.

- `npm run db:init` does not seed holdings or quote snapshots.
- `npm run db:seed` intentionally loads demo holdings, snapshots, and dividends.

Instrument catalog behavior:

- A baseline local ETF catalog is loaded from `database/instruments.sql` during
  database initialization/startup.
- This catalog powers `GET /api/instruments/search`.
- Existing holdings symbols are also backfilled into `instruments` when needed
  so older databases remain compatible.

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
- HKEX backup implementation: `backend/src/services/quotes/providers/HkexQuoteProvider.ts`
- Demo implementation: `backend/src/services/quotes/providers/DemoQuoteProvider.ts`

To add another provider, implement `QuoteProvider` and register it in
`createQuoteService.ts`.

## Yahoo provider note

Yahoo is used as an unofficial delayed quote source. It can occasionally fail,
timeout, or rate-limit. When this happens, the app keeps the last cached data
and surfaces a warning instead of writing fabricated prices.

## HKEX backup note

HKEX backup uses HKEX public delayed quote widget endpoints as a secondary
source for symbols that fail in Yahoo. If HKEX is also unavailable, no quote is
fabricated and older cached data stays in place.

## SQLite schema

`database/schema.sql` defines:

- `instruments`
- `holdings`
- `watchlist`
- `transactions`
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
- `GET /api/instruments/search?q=...`
- `GET /api/instruments/:symbol`
- `POST /api/instruments/sync`
- `GET /api/firebase/status`
- `POST /api/firebase/sync`
- `POST /api/firebase/restore`
- `GET /api/watchlist`
- `POST /api/watchlist`
- `DELETE /api/watchlist/:id`
- `GET /api/transactions?symbol=...`
- `POST /api/transactions`
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

`POST /api/instruments/sync` checks active catalog/tracked symbols against HKEX
public metadata, updates `name_en`/`name_zh`/issuer/currency, and marks invalid
symbols inactive if HKEX reports invalid input.

`POST /api/firebase/sync` writes selected symbols and purchase/transaction items
to Firestore using your configured service account.

`POST /api/firebase/restore` pulls the latest cloud snapshot and restores local
SQLite tables. On server startup, restore is automatically attempted when
`FIREBASE_RESTORE_ON_BOOT=true` and local tables are empty.

## HKEX invalid input note

If refresh returns `HKEX quote unavailable (002 Invalid Input)`, the symbol is
not recognized by HKEX ETP quote API. Typical causes are wrong code or symbol
not in HKEX ETP universe. Use **Settings / Data -> Sync names with HKEX** to
reconcile symbol metadata and review suggested symbols.

Legacy mapping note: `02006` is mapped to current code `03417` in quote
normalization to reduce refresh failures from obsolete symbol input.

## Persisting production changes

On Vercel, local SQLite (`/tmp/portfolio.db`) is ephemeral, so direct writes do
not persist across cold starts. Enable Firebase sync to persist selected symbols
and purchase/transaction data across restarts.

Typical flow:

1. Configure Firebase env variables in Vercel.
2. Save any change in Holdings/Dividends/Settings.
3. Backend auto-syncs to Firebase after successful writes.
4. On next cold start, backend auto-restores from Firebase when local DB is empty.
