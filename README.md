# Farming Competition

A full-stack web app for tracking a fitness competition. Features Strava integration, manual activity logging, and a constitutional amendment system.

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **SQLite** via Drizzle ORM (libsql)
- **Tailwind CSS 4** + shadcn/ui-inspired components
- **Recharts** for data visualization
- **Strava OAuth2** for activity sync

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and review the variables (see [Environment Variables](#environment-variables) below). The defaults work for local development — the only thing you may want to change is `SESSION_SECRET`.

### 3. Seed the database

```bash
npm run db:seed
```

This walks you through an interactive setup:
- How many farmers (competitors) to create
- Each farmer's name, 4-digit PIN, and color

The seed script creates the current season and base scoring rules automatically.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with any farmer name + PIN you set during seed.

## Environment Variables

Create a `.env.local` file (or copy `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite database path. Default: `file:./farming.db` |
| `SESSION_SECRET` | Yes | Secret for signing session cookies. Change this from the default. |
| `NEXT_PUBLIC_APP_URL` | Yes | Your app's public URL. Default: `http://localhost:3000` |
| `STRAVA_CLIENT_ID` | No | Strava API client ID (from [strava.com/settings/api](https://www.strava.com/settings/api)). Only needed for Strava sync. |
| `STRAVA_CLIENT_SECRET` | No | Strava API client secret. Only needed for Strava sync. |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | No | Random string for Strava webhook verification. |
| `STRAVA_SYNC_SECRET` | No | Secret for the automated sync cron endpoint (`/api/strava/sync-all`). |

The app works fully without Strava — you can log all activities manually.

## Default Login

Credentials are whatever you set during `npm run db:seed`. Each farmer has a name and a 4-digit PIN.

## Adding More Farmers

Once the app is running, logged-in users can add new farmers from the **Settings** page.

## Features

### Dashboard
Season leaderboard with standings, gap-to-leader stats, weekly pace projections, Hall of Fame (past champions), Hall of Shame (most off-season points), and all-time records.

### Activities
Grid and sheet views with per-user tables, sortable columns, and points-intensity row highlighting. Manual entry form with live score preview. Strava-imported activities show an "S" badge. Filter by source (Strava/Manual), indoor, or view all.

### Amendments
A constitutional amendment system for proposing and voting on rule changes. The full history of amendments, votes, and rejections is preserved.

### Strava Integration
OAuth2 flow to connect a Strava account. Manual sync imports activities from the current calendar year, skipping unsupported types (only run, ride, swim, and weight training are competition-eligible). Deduplication by Strava activity ID means re-syncing is safe. Webhook support for real-time sync.

## Database Schema

7 tables defined in `lib/db/schema.ts` using Drizzle ORM:

| Table | Description |
|-------|-------------|
| `users` | Competitors. Name, PIN, color, and optional Strava OAuth tokens (athlete ID, access/refresh tokens, expiry). |
| `activities` | Every logged activity. Linked to a user, tracks type (run/ride/swim/weight_training), source (strava/manual), distance, duration, elevation, calories, pounds lifted, computed points (raw + modified), a JSON `point_breakdown`, activity date, season year, and engine version. Strava activities store a `strava_activity_id` for dedup. |
| `seasons` | One row per competition year. Start/end dates, active flag, and optional champion. |
| `scoring_rules` | Config-driven scoring rules. Each has a `rule_type`, JSON `config`, active flag, and `effective_season`. Optionally linked to the amendment that created it. |
| `scoring_engine_versions` | Append-only version log. Tracks version string, summary of changes, and effective date. |
| `amendments` | Rule change proposals. Number, title, description, proposer, status (voting/approved/rejected/deferred), effective date, season, and voting window. |
| `votes` | Individual votes on amendments, linked to both the amendment and the voting user. |

## Project Structure

```
app/
  page.tsx                  Dashboard
  activities/page.tsx       Activities (grid/sheet views)
  amendments/page.tsx       Amendment proposals & voting
  settings/page.tsx         Strava connection, scoring rules display
  login/page.tsx            PIN-based login
  api/
    activities/             CRUD + scoring on create
    leaderboard/            Standings, cumulative points, all-time records
    amendments/             Proposals, voting
    scoring/                Calculate, rules, engine versions
    strava/                 OAuth, sync, webhook
    auth/                   Login, logout, session
components/
  cumulative-chart.tsx      Season-long points chart per user
  manual-entry-form.tsx     Activity entry with live score preview
  nav.tsx                   Navigation + dark mode toggle
  trend-chart.tsx           Trend visualization
lib/
  db/
    schema.ts               7 Drizzle tables
    scoring-config.ts       Scoring rules & engine versions (source of truth)
  scoring/
    engine.ts               Applies rules, handles off-season
    active-rules.ts         Shared DB query for active rules by season
    rules.ts                Individual rule calculators
    types.ts                TypeScript interfaces
  strava/
    client.ts               Strava API client with token refresh
    mapper.ts               Strava -> internal activity format
    token-manager.ts        Shared token refresh + DB persist
    webhook.ts              Real-time event handler
  utils/
    season.ts               Shared season calculation
  auth.ts                   Cookie-based session management
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:seed` | Interactive database setup (farmers, season, scoring rules) |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:push` | Push schema to database |
| `npm test` | Run test suite |
