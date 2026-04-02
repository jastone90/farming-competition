import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { createUser, createActivity } from "../helpers/seed-helpers";
import { scoreActivity } from "@/lib/scoring/engine";
import { ALL_RULES } from "../helpers/all-rules";
import { activities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { ScoringInput } from "@/lib/scoring/types";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
});

afterEach(() => {
  testDb.close();
});

describe("activity lifecycle", () => {
  it("full lifecycle: create → score → store → query → delete", async () => {
    await createUser(testDb, { name: "Alan" });

    // Score
    const input: ScoringInput = {
      type: "run",
      isIndoor: false,
      distanceMiles: 5.2,
      elevationGainFeet: 320,
    };
    const scored = scoreActivity(input, ALL_RULES);

    // Store
    const act = await createActivity(testDb, {
      userId: 1,
      title: "Morning Run",
      type: "run",
      distanceMiles: 5.2,
      elevationGainFeet: 320,
      rawPoints: scored.rawPoints,
      modifiedPoints: scored.modifiedPoints,
      pointBreakdown: JSON.stringify(scored.pointBreakdown),
    });
    expect(act.rawPoints).toBeGreaterThan(5);

    // Query back
    const rows = await testDb.db
      .select()
      .from(activities)
      .where(eq(activities.id, act.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].modifiedPoints).toBe(scored.modifiedPoints);

    // Delete
    await testDb.db.delete(activities).where(eq(activities.id, act.id));
    const after = await testDb.db.select().from(activities);
    expect(after).toHaveLength(0);
  });

  it("cross-user isolation: users only see their own activities", async () => {
    await createUser(testDb, { name: "Alan" });
    await createUser(testDb, { name: "Brian" });
    await createActivity(testDb, { userId: 1, title: "Alan Run", type: "run" });
    await createActivity(testDb, { userId: 2, title: "Brian Ride", type: "ride" });

    const alanActs = await testDb.db
      .select()
      .from(activities)
      .where(eq(activities.userId, 1));
    expect(alanActs).toHaveLength(1);
    expect(alanActs[0].title).toBe("Alan Run");

    const brianActs = await testDb.db
      .select()
      .from(activities)
      .where(eq(activities.userId, 2));
    expect(brianActs).toHaveLength(1);
    expect(brianActs[0].title).toBe("Brian Ride");
  });

  it("season filtering returns only matching season", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, {
      userId: 1,
      title: "2025 Run",
      type: "run",
      season: 2025,
      activityDate: "2025-06-01",
    });
    await createActivity(testDb, {
      userId: 1,
      title: "2026 Run",
      type: "run",
      season: 2026,
      activityDate: "2026-03-01",
    });

    const s2026 = await testDb.db
      .select()
      .from(activities)
      .where(eq(activities.season, 2026));
    expect(s2026).toHaveLength(1);
    expect(s2026[0].title).toBe("2026 Run");
  });

  it("rule version sensitivity: different rules produce different scores", async () => {
    const input: ScoringInput = {
      type: "run",
      isIndoor: false,
      distanceMiles: 5,
      elevationGainFeet: 750,
    };

    // With elevation bonus
    const withElev = scoreActivity(input, ALL_RULES);

    // Without elevation bonus (pre-2023 rules)
    const baseOnly = scoreActivity(input, [
      { ruleType: "base_running", config: { pointsPerMile: 1 } },
    ]);

    expect(withElev.rawPoints).toBeGreaterThan(baseOnly.rawPoints);
  });

  it("stores and retrieves point breakdown as JSON", async () => {
    await createUser(testDb, { name: "Alan" });
    const breakdown = { base: { label: "5 mi × 1 pt/mi", points: 5 } };
    const act = await createActivity(testDb, {
      userId: 1,
      title: "Run",
      type: "run",
      pointBreakdown: JSON.stringify(breakdown),
    });
    const parsed = JSON.parse(act.pointBreakdown);
    expect(parsed.base.points).toBe(5);
  });

  it("handles strava source activities", async () => {
    await createUser(testDb, { name: "Alan" });
    const act = await createActivity(testDb, {
      userId: 1,
      title: "Strava Run",
      type: "run",
      source: "strava",
      stravaActivityId: "12345",
    });
    expect(act.source).toBe("strava");
    expect(act.stravaActivityId).toBe("12345");
  });

  it("engine version is stored and retrieved in lifecycle", async () => {
    await createUser(testDb, { name: "Alan" });

    // Score
    const input: ScoringInput = {
      type: "run",
      isIndoor: false,
      distanceMiles: 3.0,
    };
    const scored = scoreActivity(input, ALL_RULES);

    // Store with engine version
    const act = await createActivity(testDb, {
      userId: 1,
      title: "Versioned Run",
      type: "run",
      distanceMiles: 3.0,
      rawPoints: scored.rawPoints,
      modifiedPoints: scored.modifiedPoints,
      pointBreakdown: JSON.stringify(scored.pointBreakdown),
      engineVersion: "1.0",
    });
    expect(act.engineVersion).toBe("1.0");

    // Query back — version persists
    const rows = await testDb.db
      .select()
      .from(activities)
      .where(eq(activities.id, act.id));
    expect(rows[0].engineVersion).toBe("1.0");
    expect(rows[0].rawPoints).toBe(scored.rawPoints);
  });

  it("multiple activities per user per day", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, {
      userId: 1,
      title: "Morning Run",
      type: "run",
      activityDate: "2026-03-15",
    });
    await createActivity(testDb, {
      userId: 1,
      title: "Evening Ride",
      type: "ride",
      activityDate: "2026-03-15",
    });

    const rows = await testDb.db
      .select()
      .from(activities)
      .where(
        and(eq(activities.userId, 1), eq(activities.activityDate, "2026-03-15"))
      );
    expect(rows).toHaveLength(2);
  });
});
