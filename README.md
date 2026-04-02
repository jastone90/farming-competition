# Farming Competition

A full-stack web app for 4 friends (Alan, Brian, Martin, Will) to track a fitness/mileage competition. Replaces a multi-year Excel spreadsheet with Strava integration, manual activity entry, a constitutional amendment voting system, and historical tracking across seasons (2022–present).

## Tech Stack

- **Framework:** Next.js 15 (App Router), TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui-inspired components
- **Database:** SQLite via Drizzle ORM + libsql
- **Charts:** Recharts
- **Auth:** Simple PIN-based (4 users)
- **Strava:** OAuth2 + webhook subscription for real-time sync

## Getting Started

```bash
# Install dependencies
npm install

# Seed the database (4 users, amendments, scoring rules, sample activities)
npm run db:seed

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.


## Pages

- **Dashboard** (`/`) — Season leaderboard, weekly progress, stats
- **Activities** (`/activities`) — Reverse-chron feed, filter by source/type, manual entry with score preview
- **Amendments** (`/amendments`) — Propose rule changes, vote (Yee/Nah), 3/4 supermajority threshold
- **History** (`/history`) — Multi-year trend chart, season champions, all-time records
- **Settings** (`/settings`) — Strava connection, backfill sync, active scoring rules

## Scoring Engine

The scoring engine is config-driven — rules are stored in the database and applied dynamically per season. Each activity gets a transparent `pointBreakdown` JSON showing exactly how points were calculated.

**Base rules:**
- Biking: 1 point per mile
- Running: 1 point per mile

**Amendment-derived rules:**
- Indoor activities receive 83% of outdoor points
- Outdoor running gets +0.00133333 pts/ft elevation gain
- General physical activities: 5 pts per 30-min block
- Calorie-based alternative: 1 pt per 40 calories (uses whichever method scores higher)
- Martin William Paul Ayers Memorial Handicap (configurable)

**Seasons run Feb 1 – Dec 31.**

## Strava Integration

1. Log in and go to Settings
2. Click "Connect Strava" to authorize via OAuth2
3. Activities sync automatically via webhook, or use "Sync Past Activities" for backfill

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your Strava API credentials:

```env
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_WEBHOOK_VERIFY_TOKEN=your-random-string
DATABASE_URL=file:./farming.db
SESSION_SECRET=your-session-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:seed` | Seed database with users, amendments, rules, sample data |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:push` | Push schema to database |

## Project Structure

```
app/                    Pages and API routes (Next.js App Router)
components/             Reusable UI components
lib/
  db/                   Drizzle schema, connection, seed script
  scoring/              Config-driven scoring engine
  strava/               API client, activity mapper, webhook handler
  auth.ts               PIN-based session auth
```

## Deploy

Deploy to Vercel or any platform that supports Next.js. The SQLite database file is local — for production, consider switching to Turso (libsql-compatible hosted SQLite).
