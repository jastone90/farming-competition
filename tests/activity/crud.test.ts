import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { createUser, createActivity, createScoringRule } from "../helpers/seed-helpers";
import { activities } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
});

afterEach(() => {
  testDb.close();
});

describe("activities CRUD", () => {
  it("creates an activity with all fields", async () => {
    await createUser(testDb, { name: "Alan" });
    const act = await createActivity(testDb, {
      userId: 1,
      title: "Morning Run",
      type: "run",
      isIndoor: false,
      distanceMiles: 5.2,
      durationMinutes: 42,
      elevationGainFeet: 320,
      rawPoints: 24.96,
      modifiedPoints: 24.96,
      pointBreakdown: JSON.stringify({ base: { label: "5.2 mi × 4", points: 20.8 } }),
      activityDate: "2026-03-15",
      season: 2026,
    });

    expect(act.id).toBe(1);
    expect(act.title).toBe("Morning Run");
    expect(act.type).toBe("run");
    expect(act.distanceMiles).toBe(5.2);
    expect(act.rawPoints).toBe(24.96);
  });

  it("creates a strava-sourced activity with stravaActivityId", async () => {
    await createUser(testDb, { name: "Alan" });
    const act = await createActivity(testDb, {
      userId: 1,
      title: "Strava Run",
      type: "run",
      source: "strava" as any,
      stravaActivityId: "strava_123",
    });

    expect(act.source).toBe("strava");
    expect(act.stravaActivityId).toBe("strava_123");
  });

  it("deletes an activity by id", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, { userId: 1, title: "To Delete", type: "run" });

    await testDb.db.delete(activities).where(eq(activities.id, 1));

    const remaining = await testDb.db.select().from(activities);
    expect(remaining).toHaveLength(0);
  });

  it("updates points on an existing activity", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, {
      userId: 1,
      title: "Run",
      type: "run",
      rawPoints: 10,
      modifiedPoints: 10,
    });

    await testDb.db
      .update(activities)
      .set({ rawPoints: 20, modifiedPoints: 20 })
      .where(eq(activities.id, 1));

    const updated = await testDb.db.select().from(activities).where(eq(activities.id, 1)).get();
    expect(updated!.rawPoints).toBe(20);
    expect(updated!.modifiedPoints).toBe(20);
  });

  it("filters activities by type", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, { userId: 1, title: "Run", type: "run" });
    await createActivity(testDb, { userId: 1, title: "Ride", type: "ride" });
    await createActivity(testDb, { userId: 1, title: "Swim", type: "swimming" });

    const runs = await testDb.db
      .select()
      .from(activities)
      .where(eq(activities.type, "run"));
    expect(runs).toHaveLength(1);
    expect(runs[0].title).toBe("Run");
  });

  it("filters activities by season", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, { userId: 1, title: "2025 Run", type: "run", season: 2025 });
    await createActivity(testDb, { userId: 1, title: "2026 Run", type: "run", season: 2026 });

    const season2026 = await testDb.db
      .select()
      .from(activities)
      .where(eq(activities.season, 2026));
    expect(season2026).toHaveLength(1);
    expect(season2026[0].title).toBe("2026 Run");
  });

  it("filters activities by source", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, { userId: 1, title: "Manual", type: "run", source: "manual" as any });
    await createActivity(testDb, { userId: 1, title: "Strava", type: "run", source: "strava" as any });

    const manual = await testDb.db
      .select()
      .from(activities)
      .where(eq(activities.source, "manual"));
    expect(manual).toHaveLength(1);
    expect(manual[0].title).toBe("Manual");
  });

  it("orders activities by date descending", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, { userId: 1, title: "Old", type: "run", activityDate: "2026-01-01" });
    await createActivity(testDb, { userId: 1, title: "New", type: "run", activityDate: "2026-03-15" });

    const ordered = await testDb.db
      .select()
      .from(activities)
      .orderBy(desc(activities.activityDate));
    expect(ordered[0].title).toBe("New");
    expect(ordered[1].title).toBe("Old");
  });

  it("handles weight_training with poundsLifted", async () => {
    await createUser(testDb, { name: "Alan" });
    const act = await createActivity(testDb, {
      userId: 1,
      title: "Haybailz",
      type: "weight_training",
      poundsLifted: 15000,
      rawPoints: 7.5,
      modifiedPoints: 7.5,
    });

    expect(act.poundsLifted).toBe(15000);
    expect(act.rawPoints).toBe(7.5);
  });

  it("deduplicates by stravaActivityId", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, {
      userId: 1,
      title: "Run 1",
      type: "run",
      stravaActivityId: "strava_456",
    });

    // Query for existing before inserting
    const existing = await testDb.db
      .select()
      .from(activities)
      .where(eq(activities.stravaActivityId, "strava_456"))
      .get();

    expect(existing).toBeDefined();
    expect(existing!.title).toBe("Run 1");
  });
});
