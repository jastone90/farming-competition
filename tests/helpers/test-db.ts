import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";

const DDL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pin TEXT NOT NULL,
    strava_athlete_id TEXT,
    strava_access_token TEXT,
    strava_refresh_token TEXT,
    strava_token_expires_at INTEGER,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS seasons (
    year INTEGER PRIMARY KEY,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    champion_user_id INTEGER REFERENCES users(id),
    is_active INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    source TEXT NOT NULL,
    strava_activity_id TEXT,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    is_indoor INTEGER NOT NULL DEFAULT 0,
    distance_miles REAL,
    duration_minutes REAL,
    elevation_gain_feet REAL,
    calories_burned REAL,
    pounds_lifted REAL,
    raw_points REAL NOT NULL DEFAULT 0,
    modified_points REAL NOT NULL DEFAULT 0,
    point_breakdown TEXT NOT NULL DEFAULT '{}',
    activity_date TEXT NOT NULL,
    season INTEGER NOT NULL,
    engine_version TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS amendments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    proposed_by_user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL,
    effective_date TEXT,
    season INTEGER NOT NULL,
    voting_opens_at TEXT NOT NULL,
    voting_closes_at TEXT,
    rejection_commentary TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amendment_id INTEGER NOT NULL REFERENCES amendments(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    vote TEXT NOT NULL,
    cast_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scoring_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amendment_id INTEGER REFERENCES amendments(id),
    rule_type TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    is_active INTEGER NOT NULL DEFAULT 1,
    effective_season INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scoring_engine_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL,
    summary TEXT NOT NULL,
    effective_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    metadata TEXT NOT NULL DEFAULT '{}',
    is_sketch INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`;

export function createTestDb() {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });

  return {
    client,
    db,
    async setup() {
      await client.executeMultiple(DDL);
    },
    close() {
      client.close();
    },
  };
}

export type TestDb = ReturnType<typeof createTestDb>;
