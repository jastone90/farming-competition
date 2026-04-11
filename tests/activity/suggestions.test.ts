import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { users, activities } from "@/lib/db/schema";
import { buildSuggestions } from "@/lib/suggestions";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
});

afterEach(() => {
  testDb.close();
});

async function createUser(name: string): Promise<number> {
  const now = new Date().toISOString();
  const [row] = await testDb.db
    .insert(users)
    .values({ name, pin: "0000", color: "#fff", createdAt: now })
    .returning();
  return row.id;
}

type ActivityInput = {
  userId: number;
  title: string;
  type: "ride" | "run" | "weight_training" | "swimming";
  isIndoor?: boolean;
  withChild?: boolean;
  distanceMiles?: number | null;
  elevationGainFeet?: number | null;
  poundsLifted?: number | null;
  season?: number;
  activityDate?: string;
  createdAt?: string;
};

let createdSeq = 0;
async function insertActivity(a: ActivityInput) {
  // Bump a counter so createdAt ordering matches insertion order even for
  // inserts that happen within the same millisecond.
  createdSeq += 1;
  const createdAt =
    a.createdAt ??
    new Date(Date.now() + createdSeq).toISOString();
  await testDb.db.insert(activities).values({
    userId: a.userId,
    source: "manual",
    title: a.title,
    type: a.type,
    isIndoor: a.isIndoor ?? false,
    withChild: a.withChild ?? false,
    distanceMiles: a.distanceMiles ?? null,
    elevationGainFeet: a.elevationGainFeet ?? null,
    poundsLifted: a.poundsLifted ?? null,
    activityDate: a.activityDate ?? "2026-03-15",
    season: a.season ?? 2026,
    createdAt,
  });
}

beforeEach(() => {
  createdSeq = 0;
});

describe("buildSuggestions", () => {
  it("returns [] for a user with no activities", async () => {
    const userId = await createUser("Alan");
    const result = await buildSuggestions(userId, 2026, testDb.db);
    expect(result).toEqual([]);
  });

  it("groups activities with identical metrics, ignoring title", async () => {
    const userId = await createUser("Alan");
    await insertActivity({ userId, title: "Morning Run", type: "run", distanceMiles: 3.2, elevationGainFeet: 150 });
    await insertActivity({ userId, title: "Lunch Run", type: "run", distanceMiles: 3.2, elevationGainFeet: 150 });
    await insertActivity({ userId, title: "Trail Run", type: "run", distanceMiles: 3.2, elevationGainFeet: 150 });

    const result = await buildSuggestions(userId, 2026, testDb.db);

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
    // Title comes from the most-recently-created matching row
    expect(result[0].title).toBe("Trail Run");
    expect(result[0].distanceMiles).toBe(3.2);
    expect(result[0].elevationGainFeet).toBe(150);
  });

  it("scopes suggestions to a single user", async () => {
    const alan = await createUser("Alan");
    const beth = await createUser("Beth");
    await insertActivity({ userId: alan, title: "Alan's Run", type: "run", distanceMiles: 3 });
    await insertActivity({ userId: beth, title: "Beth's Run", type: "run", distanceMiles: 10 });
    await insertActivity({ userId: beth, title: "Beth's Ride", type: "ride", distanceMiles: 20 });

    const alanResult = await buildSuggestions(alan, 2026, testDb.db);
    expect(alanResult).toHaveLength(1);
    expect(alanResult[0].title).toBe("Alan's Run");
    expect(alanResult[0].distanceMiles).toBe(3);
  });

  it("orders buckets by count descending", async () => {
    const userId = await createUser("Alan");
    await insertActivity({ userId, title: "Short Run", type: "run", distanceMiles: 3 });
    await insertActivity({ userId, title: "Short Run", type: "run", distanceMiles: 3 });
    await insertActivity({ userId, title: "Long Run", type: "run", distanceMiles: 5 });

    const result = await buildSuggestions(userId, 2026, testDb.db);

    expect(result).toHaveLength(2);
    expect(result[0].distanceMiles).toBe(3);
    expect(result[0].count).toBe(2);
    expect(result[1].distanceMiles).toBe(5);
    expect(result[1].count).toBe(1);
  });

  it("treats null metric fields as matching each other in GROUP BY", async () => {
    const userId = await createUser("Alan");
    await insertActivity({
      userId,
      title: "Haybailz",
      type: "weight_training",
      poundsLifted: 15000,
      distanceMiles: null,
      elevationGainFeet: null,
      isIndoor: true,
    });
    await insertActivity({
      userId,
      title: "Haybailz Evening",
      type: "weight_training",
      poundsLifted: 15000,
      distanceMiles: null,
      elevationGainFeet: null,
      isIndoor: true,
    });

    const result = await buildSuggestions(userId, 2026, testDb.db);

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
    expect(result[0].poundsLifted).toBe(15000);
    expect(result[0].distanceMiles).toBeNull();
    expect(result[0].elevationGainFeet).toBeNull();
    // Title comes from the most-recent row
    expect(result[0].title).toBe("Haybailz Evening");
  });

  it("treats indoor and outdoor as distinct buckets", async () => {
    const userId = await createUser("Alan");
    await insertActivity({ userId, title: "Outdoor Ride", type: "ride", distanceMiles: 10, isIndoor: false });
    await insertActivity({ userId, title: "Trainer Ride", type: "ride", distanceMiles: 10, isIndoor: true });

    const result = await buildSuggestions(userId, 2026, testDb.db);

    expect(result).toHaveLength(2);
    const indoor = result.find((r) => r.isIndoor);
    const outdoor = result.find((r) => !r.isIndoor);
    expect(indoor?.title).toBe("Trainer Ride");
    expect(outdoor?.title).toBe("Outdoor Ride");
  });

  it("treats withChild as part of the bucket key", async () => {
    const userId = await createUser("Alan");
    await insertActivity({ userId, title: "Stroller Run", type: "run", distanceMiles: 3, withChild: true });
    await insertActivity({ userId, title: "Solo Run", type: "run", distanceMiles: 3, withChild: false });

    const result = await buildSuggestions(userId, 2026, testDb.db);

    expect(result).toHaveLength(2);
  });

  it("falls back to all-time when the current season has no activities", async () => {
    const userId = await createUser("Alan");
    await insertActivity({ userId, title: "Last Year Run", type: "run", distanceMiles: 4, season: 2025, activityDate: "2025-06-01" });

    const result = await buildSuggestions(userId, 2026, testDb.db);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Last Year Run");
  });

  it("prefers current-season activities over fallback when both exist", async () => {
    const userId = await createUser("Alan");
    // 5 prior-season rides
    for (let i = 0; i < 5; i++) {
      await insertActivity({ userId, title: `Prior Ride ${i}`, type: "ride", distanceMiles: 10, season: 2025, activityDate: "2025-07-01" });
    }
    // 1 current-season run
    await insertActivity({ userId, title: "This Year Run", type: "run", distanceMiles: 3, season: 2026, activityDate: "2026-01-15" });

    const result = await buildSuggestions(userId, 2026, testDb.db);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("run");
    expect(result[0].title).toBe("This Year Run");
  });

  it("caps results at 10 buckets", async () => {
    const userId = await createUser("Alan");
    for (let i = 0; i < 15; i++) {
      await insertActivity({ userId, title: `Run ${i}`, type: "run", distanceMiles: i + 1 });
    }

    const result = await buildSuggestions(userId, 2026, testDb.db);

    expect(result).toHaveLength(10);
  });
});
