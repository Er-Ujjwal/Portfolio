# Ujjwal Rauniyar — Portfolio

A personal portfolio site built with **Next.js 16 (App Router), TypeScript, and Tailwind CSS v4**.

## What’s inside

- **Hero** — big lowercase name, personal quote, tag pills, a tidy row of live stat cards (visitor IP + city, ping, and an “on earth for X years” age counter ticking with 9 decimals), a rotating visitor globe with real country boundaries and an arrow marking your location, falling-snowflake canvas, and a real interactive GitHub contributions heatmap (hover any cell for its date + count) with live repo/follower stats.
- **Sections** — about · cool places i work · cool things i build · cool places i learn · cool things i know · cool things i won · cool certs i earned · connect · visitors.
- **Visitor analytics** — live metrics (visits, cities, countries, live-now), a recent-activity feed, and top countries, powered by Upstash Redis via `/api/track` (heartbeat) and `/api/stats`. Without Upstash credentials the section shows placeholder dashes and “Waiting for visitors...” — never fake numbers.

All copy and data are Ujjwal’s own. The age counter reads `BIRTH_DATE` from `lib/config.ts` — set it to `null` to hide the widget.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production build

```bash
npm run build
npm start
```

## Visitor analytics setup (Upstash Redis)

The visitors section tracks real analytics: total visits, distinct cities and
countries, live-now count, recent activity, and top countries.

1. Create a free Redis database at [upstash.com](https://upstash.com) (serverless, no card needed).
2. In the Upstash dashboard, open your database → **REST API** and copy the **REST URL** and **REST token**.
3. Add them as environment variables (Vercel: Project → Settings → Environment Variables):
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Redeploy.

How it works: the browser generates a session id (stored in `sessionStorage`),
`POST /api/track` heartbeats every 30s (session kept alive 90s; first
heartbeat per session increments totals and geo counters), and `GET /api/stats`
refreshes the dashboard every 30s. Geo comes from Vercel's `x-vercel-ip-*`
headers, falling back to a server-side ipapi.co lookup. Without the env vars,
the section degrades gracefully to placeholder dashes — nothing is faked.

## Deploy to Vercel (2 minutes)

1. Push this folder to a GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new) and **Import** the repo.
3. Vercel auto-detects Next.js — leave the defaults (no env vars needed) and hit **Deploy**.

Alternatively, from this folder with the Vercel CLI:

```bash
npx vercel        # first run links the project
npx vercel --prod # deploy to production
```

Every push to the main branch redeploys automatically. A custom domain can be added later from the Vercel dashboard (Project → Settings → Domains).
