# Farming Competition

A full-stack web app for tracking a fitness competition. Features Strava integration, manual activity logging, a constitutional amendment system, and historical data going back to 2022.

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **SQLite** via Drizzle ORM (libsql)
- **Tailwind CSS 4** + shadcn/ui-inspired components
- **Recharts** for data visualization
- **Strava OAuth2** for activity sync

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

## Getting Started

```bash
npm install
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Users and PINs are configured in the seed script.

### Environment Variables

Create a `.env.local` file:

```env
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_WEBHOOK_VERIFY_TOKEN=your-random-string
DATABASE_URL=file:./farming.db
SESSION_SECRET=your-session-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

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
| `npm run db:seed` | Seed database (users, amendments, scoring rules) |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:push` | Push schema to database |
| `npm test` | Run test suite (197 tests) |
