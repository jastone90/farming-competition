import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import {
  createUser,
  createActivity,
  createAmendment,
  castVote,
  createScoringRule,
  createSeason,
} from "../helpers/seed-helpers";
import { users, activities, amendments, votes, scoringRules, seasons } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
});

afterEach(() => {
  testDb.close();
});

describe("CRUD operations", () => {
  describe("users", () => {
    it("creates and reads a user", async () => {
      const user = await createUser(testDb, { name: "TestUser" });
      expect(user.id).toBe(1);
      expect(user.name).toBe("TestUser");
    });

    it("updates a user", async () => {
      await createUser(testDb, { name: "Original" });
      await testDb.db.update(users).set({ name: "Updated" }).where(eq(users.id, 1));
      const rows = await testDb.db.select().from(users).where(eq(users.id, 1));
      expect(rows[0].name).toBe("Updated");
    });

    it("deletes a user", async () => {
      await createUser(testDb, { name: "ToDelete" });
      await testDb.db.delete(users).where(eq(users.id, 1));
      const rows = await testDb.db.select().from(users);
      expect(rows).toHaveLength(0);
    });
  });

  describe("activities", () => {
    it("creates and reads an activity", async () => {
      await createUser(testDb, { name: "Alan" });
      const act = await createActivity(testDb, {
        userId: 1,
        title: "Morning Run",
        type: "run",
        distanceMiles: 5.0,
      });
      expect(act.id).toBe(1);
      expect(act.title).toBe("Morning Run");
      expect(act.distanceMiles).toBe(5.0);
    });

    it("updates activity points", async () => {
      await createUser(testDb, { name: "Alan" });
      await createActivity(testDb, { userId: 1, title: "Run", type: "run" });
      await testDb.db
        .update(activities)
        .set({ rawPoints: 10, modifiedPoints: 8.3 })
        .where(eq(activities.id, 1));
      const rows = await testDb.db.select().from(activities).where(eq(activities.id, 1));
      expect(rows[0].rawPoints).toBe(10);
      expect(rows[0].modifiedPoints).toBe(8.3);
    });

    it("deletes an activity", async () => {
      await createUser(testDb, { name: "Alan" });
      await createActivity(testDb, { userId: 1, title: "Run", type: "run" });
      await testDb.db.delete(activities).where(eq(activities.id, 1));
      const rows = await testDb.db.select().from(activities);
      expect(rows).toHaveLength(0);
    });
  });

  describe("amendments", () => {
    it("creates and reads an amendment", async () => {
      await createUser(testDb, { name: "Alan" });
      const amend = await createAmendment(testDb, {
        number: 1,
        title: "Test Amendment",
        proposedByUserId: 1,
      });
      expect(amend.id).toBe(1);
      expect(amend.status).toBe("voting");
    });

    it("updates amendment status", async () => {
      await createUser(testDb, { name: "Alan" });
      await createAmendment(testDb, { number: 1, title: "Test", proposedByUserId: 1 });
      await testDb.db
        .update(amendments)
        .set({ status: "approved", effectiveDate: "2026-02-01" })
        .where(eq(amendments.id, 1));
      const rows = await testDb.db.select().from(amendments).where(eq(amendments.id, 1));
      expect(rows[0].status).toBe("approved");
    });
  });

  describe("votes", () => {
    it("creates a vote", async () => {
      await createUser(testDb, { name: "Alan" });
      await createAmendment(testDb, { number: 1, title: "Test", proposedByUserId: 1 });
      const vote = await castVote(testDb, 1, 1, "yee");
      expect(vote.vote).toBe("yee");
    });
  });

  describe("scoring rules", () => {
    it("creates a scoring rule", async () => {
      const rule = await createScoringRule(testDb, {
        ruleType: "base_biking",
        config: JSON.stringify({ pointsPerMile: 1 }),
      });
      expect(rule.ruleType).toBe("base_biking");
      expect(rule.isActive).toBe(true);
    });
  });

  describe("seasons", () => {
    it("creates a season", async () => {
      const season = await createSeason(testDb, 2026, true);
      expect(season.year).toBe(2026);
      expect(season.isActive).toBe(true);
    });

    it("updates champion", async () => {
      await createUser(testDb, { name: "Alan" });
      await createSeason(testDb, 2025);
      await testDb.db
        .update(seasons)
        .set({ championUserId: 1 })
        .where(eq(seasons.year, 2025));
      const rows = await testDb.db.select().from(seasons).where(eq(seasons.year, 2025));
      expect(rows[0].championUserId).toBe(1);
    });
  });
});
