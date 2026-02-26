# Hong Kong ETF personal portfolio dashboard

This project is a personal-use portfolio dashboard for Hong Kong ETFs and a
small set of manually tracked products. It is a read-only market data app with
manual refresh. It is not a trading platform.

The MVP focuses on robust core calculations, clear portfolio visibility, and a
replaceable delayed quote provider layer.

## What this app does

The app gives you a local-first dashboard with SQLite storage and a manual
refresh workflow.

- Tracks Hong Kong ETF holdings with delayed price snapshots.
- Tracks manual products (for example flexible investment plans or funds) with
  manual price or NAV entry.
- Stores dividend records and includes dividends in total return.
- Computes market value, unrealized P/L, unrealized return, and allocation
  summaries.
- Displays dashboard, holdings, dividends, analysis, and settings pages.

## Non-goals

The MVP intentionally excludes brokerage and trading features.

- No HSBC or broker login.
- No order placement or execution.
- No real-time streaming or tick-level data.
- No paid API dependency for the first version.

## Stack

This project uses a lightweight TypeScript stack.

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Database: SQLite (`better-sqlite3`)
- Shared package: common types and calculation utilities

## Project structure

The repository is organized into clear folders by responsibility.

```text
.
├── backend/          # Express API, refresh logic, validation, SQLite access
├── frontend/         # React dashboard UI
├── shared/           # Shared TypeScript types + calculation helpers
├── database/         # SQLite schema and seed SQL
├── .env.example      # Environment variables template
└── README.md
```

## Quick start

Follow these steps to run locally.

1. Install dependencies.

   ```bash
   npm install
   ```

2. Initialize the SQLite database and seed demo data.

   ```bash
   npm run db:init
   ```

3. Start backend + frontend in dev mode.

   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173`.

The backend runs on `http://localhost:4000`.

## Scripts

Use these scripts from the repository root.

- `npm run dev`: build shared package, then run shared watcher + backend +
  frontend.
- `npm run build`: build shared, backend, and frontend for production.
- `npm run db:init`: create schema and seed data if holdings table is empty.
- `npm run db:seed`: force seed script execution.

## Environment variables

Copy `.env.example` to `.env` if you want to override defaults.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | Backend API port |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | CORS origin for frontend |
| `DB_PATH` | `database/portfolio.db` | SQLite file path override |
| `DEFAULT_QUOTE_PROVIDER` | `yahoo` | Startup quote provider |

## Manual refresh flow

The refresh pipeline is designed for personal manual updates, not streaming.

1. You open the site.
2. The frontend loads cached prices from SQLite snapshots.
3. You click **Refresh Prices** on Dashboard or Holdings.
4. The backend fetches delayed quotes through the quote service layer.
5. The backend stores new snapshot rows in `asset_snapshots`.
6. The frontend reloads computed portfolio values and allocations.

Refresh status is surfaced as `idle`, `refreshing`, `success`, or `failed`, with
the latest refresh timestamp shown in the UI.

## Seed/demo data

`database/seed.sql` includes demo holdings for these ETF-style symbols:

- `03010`
- `03153`
- `03195`
- `03421`
- `03450`
- `03466`

It also includes sample dividends, manual assets, and initial settings.

## SQLite schema

`database/schema.sql` defines these tables:

- `holdings`: ETF and listed positions entered manually.
- `manual_assets`: manually tracked products with manual price/NAV.
- `asset_snapshots`: cached delayed quote snapshots.
- `dividends`: dividend history records.
- `settings`: refresh/provider/tag settings and refresh status metadata.

## API endpoints

Core MVP endpoints:

- `GET /api/portfolio`
- `GET /api/holdings`
- `POST /api/refresh`
- `GET /api/dividends`
- `POST /api/holdings`
- `PATCH /api/holdings/:id`
- `DELETE /api/holdings/:id`

Additional endpoints used by the UI:

- `GET /api/manual-assets`
- `POST /api/manual-assets`
- `PATCH /api/manual-assets/:id`
- `DELETE /api/manual-assets/:id`
- `POST /api/dividends`
- `PATCH /api/dividends/:id`
- `DELETE /api/dividends/:id`
- `GET /api/settings`
- `PATCH /api/settings`

## Data entry and editing

The UI supports manual data management for personal records.

- Holdings page:
  - Add/edit/delete ETF holdings.
  - Add/edit/delete manual products.
  - Manage quantity, average cost, tags, strategy, region, and notes.
- Dividends page:
  - Add/edit/delete dividend records.
  - Track ex-dividend date, payment date, dividend per unit, and received
    amount.

All key portfolio calculations are generated server-side (with shared utility
functions) to keep results consistent across pages.

## Quote provider architecture

Quote fetching is abstracted behind a service layer.

- Interface: `backend/src/services/quotes/QuoteProvider.ts`
- Coordinator: `backend/src/services/quotes/QuoteService.ts`
- Provider registry: `backend/src/services/quotes/createQuoteService.ts`
- Initial provider: Yahoo delayed quote fetch (`YahooQuoteProvider`)
- Built-in fallback for local resilience: deterministic demo provider

To swap providers later, implement `QuoteProvider` and wire it in
`createQuoteService.ts`.

## Limitations

The MVP is intentionally simple and personal-use focused.

- Quote data is delayed and may not reflect tradable live prices.
- Single local SQLite database, no user auth or multi-account support.
- Manual FX handling is not included.
- Uses approximate daily change when source fields are available.

## Optional future upgrades

After MVP, these upgrades are natural next steps.

1. Add provider fallback chains with provider health metrics.
2. Add CSV import/export for holdings and dividend history.
3. Add historical charting for portfolio value and dividend yield trends.
4. Add optional local authentication for multi-profile usage.
5. Add per-asset target allocation and drift alerts.
