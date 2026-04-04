import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { createUser, createActivity } from "../helpers/seed-helpers";
import { activities, users } from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
});

afterEach(() => {
  testDb.close();
});

/** Mirrors the query in app/api/activities/farmer-of-month/route.ts */
async function getFarmerOfMonth(testDb: TestDb, year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const firstDay = `${year}-${mm}-01`;
  const lastDay = `${year}-${mm}-31`;

  const rows = await testDb.db
    .select({
      userId: activities.userId,
      name: users.name,
      color: users.color,
      totalPoints: sql<number>`COALESCE(sum(${activities.modifiedPoints}), 0)`,
      activityCount: sql<number>`count(*)`,
    })
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id))
    .where(
      sql`${activities.activityDate} >= ${firstDay} AND ${activities.activityDate} <= ${lastDay}`
    )
    .groupBy(activities.userId)
    .orderBy(sql`sum(${activities.modifiedPoints}) desc`)
    .limit(1);

  return rows.length > 0 ? rows[0] : null;
}

describe("farmer of the month", () => {
  it("returns user with most SFUs in the given month", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });
    await createUser(testDb, { name: "Brian", color: "#34C759" });

    // Alan: 20 pts from 5 mi run, Brian: 30 pts from 30 mi ride
    await createActivity(testDb, {
      userId: 1,
      title: "Run",
      type: "run",
      distanceMiles: 5,
      modifiedPoints: 20,
      activityDate: "2026-03-10",
    });
    await createActivity(testDb, {
      userId: 2,
      title: "Long Ride",
      type: "ride",
      distanceMiles: 30,
      modifiedPoints: 30,
      activityDate: "2026-03-15",
    });

    const result = await getFarmerOfMonth(testDb, 2026, 3);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Brian");
    expect(result!.totalPoints).toBe(30);
  });

  it("sums SFUs across multiple activities in the month", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });

    await createActivity(testDb, {
      userId: 1,
      title: "Run 1",
      type: "run",
      modifiedPoints: 20,
      activityDate: "2026-03-05",
    });
    await createActivity(testDb, {
      userId: 1,
      title: "Run 2",
      type: "run",
      modifiedPoints: 32,
      activityDate: "2026-03-20",
    });

    const result = await getFarmerOfMonth(testDb, 2026, 3);
    expect(result!.totalPoints).toBe(52);
    expect(result!.activityCount).toBe(2);
  });

  it("ignores activities from other months", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });
    await createUser(testDb, { name: "Brian", color: "#34C759" });

    // Brian has more points but in February
    await createActivity(testDb, {
      userId: 2,
      title: "Feb Ride",
      type: "ride",
      modifiedPoints: 100,
      activityDate: "2026-02-15",
    });
    // Alan has points in March
    await createActivity(testDb, {
      userId: 1,
      title: "Mar Run",
      type: "run",
      modifiedPoints: 20,
      activityDate: "2026-03-10",
    });

    const result = await getFarmerOfMonth(testDb, 2026, 3);
    expect(result!.name).toBe("Alan");
    expect(result!.totalPoints).toBe(20);
  });

  it("returns null when no activities exist in the month", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });

    const result = await getFarmerOfMonth(testDb, 2026, 3);
    expect(result).toBeNull();
  });

  it("picks winner by SFUs not miles", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });
    await createUser(testDb, { name: "Brian", color: "#34C759" });

    // Brian has more miles (30) but fewer SFUs (30)
    await createActivity(testDb, {
      userId: 2,
      title: "Ride",
      type: "ride",
      distanceMiles: 30,
      modifiedPoints: 30,
      activityDate: "2026-03-10",
    });
    // Alan has fewer miles (10) but more SFUs (40) from running
    await createActivity(testDb, {
      userId: 1,
      title: "Run",
      type: "run",
      distanceMiles: 10,
      modifiedPoints: 40,
      activityDate: "2026-03-10",
    });

    const result = await getFarmerOfMonth(testDb, 2026, 3);
    expect(result!.name).toBe("Alan");
    expect(result!.totalPoints).toBe(40);
  });

  it("picks the correct farmer when multiple users have activities", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });
    await createUser(testDb, { name: "Brian", color: "#34C759" });
    await createUser(testDb, { name: "Martin", color: "#FF9500" });

    await createActivity(testDb, {
      userId: 1,
      title: "Run",
      type: "run",
      modifiedPoints: 40,
      activityDate: "2026-04-05",
    });
    await createActivity(testDb, {
      userId: 2,
      title: "Ride",
      type: "ride",
      modifiedPoints: 25,
      activityDate: "2026-04-10",
    });
    await createActivity(testDb, {
      userId: 3,
      title: "Long Ride",
      type: "ride",
      modifiedPoints: 50,
      activityDate: "2026-04-15",
    });

    const result = await getFarmerOfMonth(testDb, 2026, 4);
    expect(result!.name).toBe("Martin");
    expect(result!.totalPoints).toBe(50);
  });

  it("includes color in the result", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });
    await createActivity(testDb, {
      userId: 1,
      title: "Run",
      type: "run",
      modifiedPoints: 20,
      activityDate: "2026-03-10",
    });

    const result = await getFarmerOfMonth(testDb, 2026, 3);
    expect(result!.color).toBe("#007AFF");
  });
});
