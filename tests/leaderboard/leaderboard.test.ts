import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { createUser, createActivity, createSeason } from "../helpers/seed-helpers";
import { activities, users, seasons } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
});

afterEach(() => {
  testDb.close();
});

async function getLeaderboard(testDb: TestDb, season: number) {
  const standings = await testDb.db
    .select({
      userId: activities.userId,
      totalPoints: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("total_points"),
      activityCount: sql<number>`COUNT(${activities.id})`.as("activity_count"),
    })
    .from(activities)
    .where(eq(activities.season, season))
    .groupBy(activities.userId)
    .orderBy(desc(sql`total_points`));

  const allUsers = await testDb.db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(users);

  const leaderboard = allUsers.map((user) => {
    const standing = standings.find((s) => s.userId === user.id);
    return {
      userId: user.id,
      name: user.name,
      color: user.color,
      totalPoints: standing?.totalPoints ?? 0,
      activityCount: standing?.activityCount ?? 0,
    };
  });

  leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
  return leaderboard;
}

describe("leaderboard", () => {
  it("aggregates points across multiple activities", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, {
      userId: 1,
      title: "Run 1",
      type: "run",
      modifiedPoints: 10,
    });
    await createActivity(testDb, {
      userId: 1,
      title: "Run 2",
      type: "run",
      modifiedPoints: 15,
    });

    const board = await getLeaderboard(testDb, 2026);
    expect(board[0].totalPoints).toBe(25);
    expect(board[0].activityCount).toBe(2);
  });

  it("ranks users by total points descending", async () => {
    await createUser(testDb, { name: "Alan" });
    await createUser(testDb, { name: "Brian" });
    await createUser(testDb, { name: "Martin" });
    await createActivity(testDb, { userId: 1, title: "A", type: "run", modifiedPoints: 10 });
    await createActivity(testDb, { userId: 2, title: "B", type: "run", modifiedPoints: 30 });
    await createActivity(testDb, { userId: 3, title: "C", type: "run", modifiedPoints: 20 });

    const board = await getLeaderboard(testDb, 2026);
    expect(board[0].name).toBe("Brian");
    expect(board[1].name).toBe("Martin");
    expect(board[2].name).toBe("Alan");
  });

  it("includes users with zero activities", async () => {
    await createUser(testDb, { name: "Alan" });
    await createUser(testDb, { name: "Brian" });
    await createActivity(testDb, { userId: 1, title: "Run", type: "run", modifiedPoints: 10 });

    const board = await getLeaderboard(testDb, 2026);
    expect(board).toHaveLength(2);
    const brian = board.find((e) => e.name === "Brian");
    expect(brian!.totalPoints).toBe(0);
    expect(brian!.activityCount).toBe(0);
  });

  it("isolates by season", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, {
      userId: 1,
      title: "2025",
      type: "run",
      modifiedPoints: 100,
      season: 2025,
    });
    await createActivity(testDb, {
      userId: 1,
      title: "2026",
      type: "run",
      modifiedPoints: 10,
      season: 2026,
    });

    const board2026 = await getLeaderboard(testDb, 2026);
    expect(board2026[0].totalPoints).toBe(10);

    const board2025 = await getLeaderboard(testDb, 2025);
    expect(board2025[0].totalPoints).toBe(100);
  });

  it("handles multiple users with same points", async () => {
    await createUser(testDb, { name: "Alan" });
    await createUser(testDb, { name: "Brian" });
    await createActivity(testDb, { userId: 1, title: "A", type: "run", modifiedPoints: 10 });
    await createActivity(testDb, { userId: 2, title: "B", type: "run", modifiedPoints: 10 });

    const board = await getLeaderboard(testDb, 2026);
    expect(board[0].totalPoints).toBe(10);
    expect(board[1].totalPoints).toBe(10);
  });

  it("champion detection via seasons table", async () => {
    await createUser(testDb, { name: "Alan" });
    await createSeason(testDb, 2025);
    await testDb.db
      .update(seasons)
      .set({ championUserId: 1 })
      .where(eq(seasons.year, 2025));

    const rows = await testDb.db.select().from(seasons).where(eq(seasons.year, 2025));
    expect(rows[0].championUserId).toBe(1);
  });

  it("counts activities correctly with mixed types", async () => {
    await createUser(testDb, { name: "Alan" });
    await createActivity(testDb, { userId: 1, title: "Run", type: "run", modifiedPoints: 5 });
    await createActivity(testDb, { userId: 1, title: "Ride", type: "ride", modifiedPoints: 15 });
    await createActivity(testDb, { userId: 1, title: "Swim", type: "swimming", modifiedPoints: 10 });

    const board = await getLeaderboard(testDb, 2026);
    expect(board[0].activityCount).toBe(3);
    expect(board[0].totalPoints).toBe(30);
  });

  it("empty season returns all users with 0 points", async () => {
    await createUser(testDb, { name: "Alan" });
    await createUser(testDb, { name: "Brian" });

    const board = await getLeaderboard(testDb, 2026);
    expect(board).toHaveLength(2);
    expect(board[0].totalPoints).toBe(0);
    expect(board[1].totalPoints).toBe(0);
  });
});
