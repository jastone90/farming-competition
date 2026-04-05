import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as readline from "readline";
import * as schema from "./schema";

const COLOR_PALETTE = [
  "#007AFF", "#34C759", "#FF9500", "#FF3B30",
  "#AF52DE", "#5AC8FA", "#FF2D55", "#FFCC00",
];

function createPrompt(): {
  ask: (question: string) => Promise<string>;
  close: () => void;
} {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return {
    ask: (question: string) =>
      new Promise((resolve) => rl.question(question, resolve)),
    close: () => rl.close(),
  };
}

async function seed() {
  const client = createClient({ url: "file:./farming.db" });
  const db = drizzle(client, { schema });

  // Create tables manually via raw SQL
  await client.executeMultiple(`
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
      with_child INTEGER NOT NULL DEFAULT 0,
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
  `);

  const now = new Date().toISOString();

  // Check if already seeded
  const existingUsers = await db.select().from(schema.users);
  if (existingUsers.length > 0) {
    console.log("Database already seeded, skipping.");
    client.close();
    return;
  }

  // Interactive farmer setup
  const prompt = createPrompt();

  console.log("\n🌾 Farming Competition — Database Setup\n");
  console.log("Let's set up your farmers (competitors).\n");

  let farmerCount = 0;
  while (farmerCount < 2 || farmerCount > 8) {
    const input = await prompt.ask("How many farmers? (2–8): ");
    farmerCount = parseInt(input, 10);
    if (isNaN(farmerCount) || farmerCount < 2 || farmerCount > 8) {
      console.log("Please enter a number between 2 and 8.");
      farmerCount = 0;
    }
  }

  const usedNames = new Set<string>();
  const farmers: { name: string; pin: string; color: string }[] = [];

  for (let i = 0; i < farmerCount; i++) {
    console.log(`\n--- Farmer ${i + 1} of ${farmerCount} ---`);

    // Name
    let name = "";
    while (!name) {
      name = (await prompt.ask("  Name: ")).trim();
      if (!name) {
        console.log("  Name cannot be empty.");
      } else if (usedNames.has(name.toLowerCase())) {
        console.log(`  "${name}" is already taken. Pick a different name.`);
        name = "";
      }
    }
    usedNames.add(name.toLowerCase());

    // PIN
    let pin = "";
    while (!pin) {
      pin = (await prompt.ask("  PIN (4 digits): ")).trim();
      if (!/^\d{4}$/.test(pin)) {
        console.log("  PIN must be exactly 4 digits.");
        pin = "";
      }
    }

    farmers.push({ name, pin, color: COLOR_PALETTE[i % COLOR_PALETTE.length] });
    console.log(`  ✓ ${name} added`);
  }

  prompt.close();

  // Insert farmers
  await db.insert(schema.users).values(
    farmers.map((f, i) => ({
      id: i + 1,
      name: f.name,
      pin: f.pin,
      color: f.color,
      createdAt: now,
    }))
  );
  console.log(`\nSeeded ${farmers.length} farmers`);

  // Seed current season
  const currentYear = new Date().getFullYear();
  await db.insert(schema.seasons).values([
    {
      year: currentYear,
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-25`,
      isActive: true,
    },
  ]);
  console.log(`Seeded season ${currentYear}`);

  // Seed base scoring rules
  const rulesData = [
    {
      ruleType: "base_running" as const,
      config: JSON.stringify({ pointsPerMile: 4 }),
      isActive: true,
      effectiveSeason: currentYear,
      createdAt: now,
    },
    {
      ruleType: "base_biking" as const,
      config: JSON.stringify({ pointsPerMile: 1 }),
      isActive: true,
      effectiveSeason: currentYear,
      createdAt: now,
    },
    {
      ruleType: "base_swimming" as const,
      config: JSON.stringify({ pointsPerMile: 25 }),
      isActive: true,
      effectiveSeason: currentYear,
      createdAt: now,
    },
    {
      ruleType: "elevation_bonus" as const,
      config: JSON.stringify({
        pointsPerFoot: 0.013333,
        activityType: "run",
        outdoorOnly: false,
      }),
      isActive: true,
      effectiveSeason: currentYear,
      createdAt: now,
    },
    {
      ruleType: "elevation_bonus" as const,
      config: JSON.stringify({
        pointsPerFoot: 0.003333,
        activityType: "ride",
        outdoorOnly: false,
      }),
      isActive: true,
      effectiveSeason: currentYear,
      createdAt: now,
    },
    {
      ruleType: "weight_training" as const,
      config: JSON.stringify({ pointsPer1000Lbs: 0.5 }),
      isActive: true,
      effectiveSeason: currentYear,
      createdAt: now,
    },
  ];

  await db.insert(schema.scoringRules).values(rulesData);
  console.log("Seeded 6 base scoring rules");

  // Seed scoring engine version
  await db.insert(schema.scoringEngineVersions).values([
    {
      version: "1.0",
      summary:
        "Initial engine: running 4 pts/mi, cycling 1 pt/mi, elevation bonuses (run 0.013, ride 0.003), swimming 25 pts/mi, haybailz 0.5 SFU/1000 lbs",
      effectiveDate: `${currentYear}-01-01`,
      createdAt: now,
    },
  ]);
  console.log("Seeded scoring engine v1.0");

  console.log("\n✅ Seed complete! Run `npm run dev` to start the app.\n");
  client.close();
}

seed().catch(console.error);
