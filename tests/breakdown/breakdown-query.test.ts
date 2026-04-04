import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { createUser, createActivity } from "../helpers/seed-helpers";
import { activities } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
});

afterEach(() => {
  testDb.close();
});

/** Mirrors the query in app/api/activities/breakdown/route.ts */
async function getBreakdown(testDb: TestDb) {
  return testDb.db
    .select({
      type: activities.type,
      isIndoor: activities.isIndoor,
      count: sql<number>`count(*)`,
      totalPoints: sql<number>`sum(${activities.modifiedPoints})`,
      totalMiles: sql<number>`sum(${activities.distanceMiles})`,
      totalElevation: sql<number>`sum(${activities.elevationGainFeet})`,
      totalDuration: sql<number>`sum(${activities.durationMinutes})`,
      totalPoundsLifted: sql<number>`sum(${activities.poundsLifted})`,
    })
    .from(activities)
    .groupBy(activities.type, activities.isIndoor)
    .orderBy(sql`sum(${activities.modifiedPoints}) desc`);
}

describe("breakdown query", () => {
  it("groups by type and isIndoor", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, {
      userId: 1,
      title: "Outdoor Run",
      type: "run",
      isIndoor: false,
      distanceMiles: 5,
      modifiedPoints: 20,
    });
    await createActivity(testDb, {
      userId: 1,
      title: "Indoor Run",
      type: "run",
      isIndoor: true,
      distanceMiles: 3,
      modifiedPoints: 12,
    });

    const rows = await getBreakdown(testDb);
    expect(rows).toHaveLength(2);

    const outdoor = rows.find((r) => r.type === "run" && !r.isIndoor);
    const indoor = rows.find((r) => r.type === "run" && r.isIndoor);
    expect(outdoor).toBeDefined();
    expect(indoor).toBeDefined();
    expect(outdoor!.totalPoints).toBe(20);
    expect(indoor!.totalPoints).toBe(12);
  });

  it("aggregates counts and totals within each group", async () => {
    await createUser(testDb, { name: "Alan" });
    await createUser(testDb, { name: "Brian" });
    await createActivity(testDb, {
      userId: 1,
      title: "Ride 1",
      type: "ride",
      isIndoor: false,
      distanceMiles: 10,
      modifiedPoints: 10,
      elevationGainFeet: 200,
    });
    await createActivity(testDb, {
      userId: 2,
      title: "Ride 2",
      type: "ride",
      isIndoor: false,
      distanceMiles: 20,
      modifiedPoints: 20,
      elevationGainFeet: 500,
    });

    const rows = await getBreakdown(testDb);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(2);
    expect(rows[0].totalPoints).toBe(30);
    expect(rows[0].totalMiles).toBe(30);
    expect(rows[0].totalElevation).toBe(700);
  });

  it("returns separate rows for different activity types", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, {
      userId: 1,
      title: "Run",
      type: "run",
      modifiedPoints: 20,
    });
    await createActivity(testDb, {
      userId: 1,
      title: "Ride",
      type: "ride",
      modifiedPoints: 10,
    });
    await createActivity(testDb, {
      userId: 1,
      title: "Swim",
      type: "swimming",
      isIndoor: true,
      distanceMiles: 0.5,
      modifiedPoints: 12.5,
    });
    await createActivity(testDb, {
      userId: 1,
      title: "Weights",
      type: "weight_training",
      isIndoor: true,
      poundsLifted: 10000,
      modifiedPoints: 5,
    });

    const rows = await getBreakdown(testDb);
    expect(rows).toHaveLength(4);
    // Ordered by points desc
    expect(rows[0].type).toBe("run");
    expect(rows[1].type).toBe("swimming");
    expect(rows[2].type).toBe("ride");
    expect(rows[3].type).toBe("weight_training");
  });

  it("sums poundsLifted for weight_training", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, {
      userId: 1,
      title: "Weights 1",
      type: "weight_training",
      isIndoor: true,
      poundsLifted: 15000,
      modifiedPoints: 7.5,
    });
    await createActivity(testDb, {
      userId: 1,
      title: "Weights 2",
      type: "weight_training",
      isIndoor: true,
      poundsLifted: 10000,
      modifiedPoints: 5,
    });

    const rows = await getBreakdown(testDb);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalPoundsLifted).toBe(25000);
    expect(rows[0].totalPoints).toBe(12.5);
  });

  it("sums durationMinutes", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, {
      userId: 1,
      title: "Run 1",
      type: "run",
      durationMinutes: 30,
      modifiedPoints: 10,
    });
    await createActivity(testDb, {
      userId: 1,
      title: "Run 2",
      type: "run",
      durationMinutes: 45,
      modifiedPoints: 15,
    });

    const rows = await getBreakdown(testDb);
    expect(rows[0].totalDuration).toBe(75);
  });

  it("returns empty array when no activities exist", async () => {
    const rows = await getBreakdown(testDb);
    expect(rows).toEqual([]);
  });

  it("handles null distance/elevation/pounds gracefully", async () => {
    await createUser(testDb, { name: "Alan" });
    // weight_training with no distance or elevation
    await createActivity(testDb, {
      userId: 1,
      title: "Weights",
      type: "weight_training",
      isIndoor: true,
      poundsLifted: 5000,
      modifiedPoints: 2.5,
    });

    const rows = await getBreakdown(testDb);
    expect(rows).toHaveLength(1);
    expect(rows[0].totalMiles).toBeNull();
    expect(rows[0].totalElevation).toBeNull();
    expect(rows[0].totalPoundsLifted).toBe(5000);
  });
});
