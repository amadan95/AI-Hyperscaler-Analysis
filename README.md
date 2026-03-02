# AI Lab Releases vs Hyperscaler Stocks

Next.js + TypeScript web app that ingests AI lab release events (official sources first, Google News fallback), overlays them with hyperscaler prices, and runs event-study and lag correlation analyses from 2023 onward.

## Stack

- Next.js App Router (TypeScript)
- Prisma + SQLite
- Tailwind CSS
- Recharts
- Vitest

## Data Sources

- OpenAI RSS: `https://openai.com/news/rss.xml`
- Anthropic sitemap/news pages: `https://www.anthropic.com/sitemap.xml`
- Google AI sitemap/pages: `https://blog.google/en-us/sitemap.xml`
- Google DeepMind sitemap/pages: `https://deepmind.google/sitemap.xml`
- Mistral sitemap/pages: `https://mistral.ai/sitemap.xml`
- Google News RSS fallback for blocked labs/domains
- Stooq daily prices: `https://stooq.com/q/d/l/?s={symbol}&i=d`

## Quick Start

```bash
npm install
npm run db:init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## One-Click Backfill

From the dashboard, click **Backfill 2023+**, or call:

```bash
curl -X POST http://localhost:3000/api/sync/backfill \
  -H 'content-type: application/json' \
  -d '{"from":"2023-01-01"}'
```

Incremental refresh:

```bash
curl -X POST http://localhost:3000/api/sync/incremental
```

## API Routes

- `POST /api/sync/backfill`
- `POST /api/sync/incremental`
- `GET /api/events`
- `GET /api/prices`
- `GET /api/analysis/event-study`
- `GET /api/analysis/correlations`
- `GET /api/analysis/forward-signals`
- `GET /api/status`

## Tests

```bash
npm test
```
