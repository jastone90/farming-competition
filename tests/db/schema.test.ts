import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { users, activities, amendments, votes, scoringRules, seasons, scoringEngineVersions } from "@/lib/db/schema";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
});

afterEach(() => {
  testDb.close();
});

describe("database schema", () => {
  it("creates all 7 tables", async () => {
    const result = await testDb.client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tableNames = result.rows.map((r) => r.name);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("activities");
    expect(tableNames).toContain("amendments");
    expect(tableNames).toContain("votes");
    expect(tableNames).toContain("scoring_rules");
    expect(tableNames).toContain("seasons");
    expect(tableNames).toContain("scoring_engine_versions");
  });

  it("users table has auto-incrementing id", async () => {
    const now = new Date().toISOString();
    await testDb.db.insert(users).values({ name: "Test", pin: "0000", color: "#FFF", createdAt: now });
    await testDb.db.insert(users).values({ name: "Test2", pin: "1111", color: "#000", createdAt: now });
    const rows = await testDb.db.select().from(users);
    expect(rows[0].id).toBe(1);
    expect(rows[1].id).toBe(2);
  });

  it("activities defaults rawPoints and modifiedPoints to 0", async () => {
    const now = new Date().toISOString();
    await testDb.db.insert(users).values({ name: "Test", pin: "0000", color: "#FFF", createdAt: now });
    await testDb.client.execute(
      `INSERT INTO activities (user_id, source, title, type, is_indoor, activity_date, season, created_at, point_breakdown)
       VALUES (1, 'manual', 'Test', 'run', 0, '2026-03-15', 2026, '${now}', '{}')`
    );
    const rows = await testDb.db.select().from(activities);
    expect(rows[0].rawPoints).toBe(0);
    expect(rows[0].modifiedPoints).toBe(0);
  });

  it("activities defaults isIndoor to false", async () => {
    const now = new Date().toISOString();
    await testDb.db.insert(users).values({ name: "Test", pin: "0000", color: "#FFF", createdAt: now });
    await testDb.client.execute(
      `INSERT INTO activities (user_id, source, title, type, activity_date, season, created_at, point_breakdown)
       VALUES (1, 'manual', 'Test', 'run', '2026-03-15', 2026, '${now}', '{}')`
    );
    const rows = await testDb.db.select().from(activities);
    expect(rows[0].isIndoor).toBe(false);
  });

  it("activities defaults engineVersion to null", async () => {
    const now = new Date().toISOString();
    await testDb.db.insert(users).values({ name: "Test", pin: "0000", color: "#FFF", createdAt: now });
    await testDb.client.execute(
      `INSERT INTO activities (user_id, source, title, type, activity_date, season, created_at, point_breakdown)
       VALUES (1, 'manual', 'Test', 'run', '2026-03-15', 2026, '${now}', '{}')`
    );
    const rows = await testDb.db.select().from(activities);
    expect(rows[0].engineVersion).toBeNull();
  });

  it("seasons defaults isActive to false", async () => {
    await testDb.db.insert(seasons).values({
      year: 2099,
      startDate: "2099-01-01",
      endDate: "2099-12-25",
    });
    const rows = await testDb.db.select().from(seasons);
    expect(rows[0].isActive).toBe(false);
  });
});
