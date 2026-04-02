import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { createUser, createActivity } from "../helpers/seed-helpers";
import { activities, scoringEngineVersions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { scoreActivity } from "@/lib/scoring/engine";
import type { ActiveRule } from "@/lib/scoring/types";

const NOW = new Date().toISOString();

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
});

afterEach(() => {
  testDb.close();
});

describe("scoring engine versioning", () => {
  describe("scoring_engine_versions table", () => {
    it("inserts and reads a version row", async () => {
      await testDb.db.insert(scoringEngineVersions).values({
        version: "1.0",
        summary: "Initial engine",
        effectiveDate: "2022-02-01",
        createdAt: NOW,
      });
      const rows = await testDb.db.select().from(scoringEngineVersions);
      expect(rows).toHaveLength(1);
      expect(rows[0].version).toBe("1.0");
      expect(rows[0].summary).toBe("Initial engine");
      expect(rows[0].effectiveDate).toBe("2022-02-01");
    });

    it("auto-increments id", async () => {
      await testDb.db.insert(scoringEngineVersions).values({
        version: "1.0",
        summary: "Initial",
        effectiveDate: "2022-02-01",
        createdAt: NOW,
      });
      await testDb.db.insert(scoringEngineVersions).values({
        version: "1.1",
        summary: "Added swimming",
        effectiveDate: "2025-02-01",
        createdAt: NOW,
      });
      const rows = await testDb.db.select().from(scoringEngineVersions);
      expect(rows).toHaveLength(2);
      expect(rows[0].id).toBe(1);
      expect(rows[1].id).toBe(2);
    });

    it("supports multiple versions (append-only log)", async () => {
      const versions = [
        { version: "1.0", summary: "Initial engine", effectiveDate: "2022-02-01", createdAt: NOW },
        { version: "1.1", summary: "Added swimming 25x", effectiveDate: "2025-02-01", createdAt: NOW },
        { version: "1.2", summary: "Added haybailz", effectiveDate: "2025-02-01", createdAt: NOW },
        { version: "2.0", summary: "Child rearing multiplier", effectiveDate: "2026-02-01", createdAt: NOW },
      ];
      for (const v of versions) {
        await testDb.db.insert(scoringEngineVersions).values(v);
      }
      const rows = await testDb.db.select().from(scoringEngineVersions);
      expect(rows).toHaveLength(4);
    });

    it("orders by id DESC to get latest version first", async () => {
      await testDb.db.insert(scoringEngineVersions).values([
        { version: "1.0", summary: "Initial", effectiveDate: "2022-02-01", createdAt: NOW },
        { version: "1.1", summary: "Swimming", effectiveDate: "2025-02-01", createdAt: NOW },
        { version: "2.0", summary: "Major update", effectiveDate: "2026-02-01", createdAt: NOW },
      ]);
      const latest = await testDb.db
        .select()
        .from(scoringEngineVersions)
        .orderBy(desc(scoringEngineVersions.id))
        .limit(1);
      expect(latest[0].version).toBe("2.0");
      expect(latest[0].summary).toBe("Major update");
    });

    it("returns empty array when no versions exist", async () => {
      const rows = await testDb.db.select().from(scoringEngineVersions);
      expect(rows).toHaveLength(0);
    });
  });

  describe("engine_version on activities", () => {
    it("defaults to null when not provided", async () => {
      await createUser(testDb, { name: "Alan" });
      const act = await createActivity(testDb, {
        userId: 1,
        title: "Old Run",
        type: "run",
      });
      expect(act.engineVersion).toBeNull();
    });

    it("stores engine version when provided", async () => {
      await createUser(testDb, { name: "Alan" });
      const act = await createActivity(testDb, {
        userId: 1,
        title: "New Run",
        type: "run",
        engineVersion: "1.0",
      });
      expect(act.engineVersion).toBe("1.0");
    });

    it("stores different versions for different activities", async () => {
      await createUser(testDb, { name: "Alan" });
      const act1 = await createActivity(testDb, {
        userId: 1,
        title: "Run v1.0",
        type: "run",
        engineVersion: "1.0",
        activityDate: "2026-03-01",
      });
      const act2 = await createActivity(testDb, {
        userId: 1,
        title: "Run v2.0",
        type: "run",
        engineVersion: "2.0",
        activityDate: "2026-03-02",
      });
      expect(act1.engineVersion).toBe("1.0");
      expect(act2.engineVersion).toBe("2.0");
    });

    it("historical activities with null engine_version coexist with versioned ones", async () => {
      await createUser(testDb, { name: "Alan" });

      // Simulate historical activity (no engine version)
      await createActivity(testDb, {
        userId: 1,
        title: "Historical Run",
        type: "run",
        activityDate: "2024-06-15",
        season: 2024,
      });

      // Simulate new activity (with engine version)
      await createActivity(testDb, {
        userId: 1,
        title: "New Run",
        type: "run",
        engineVersion: "1.0",
        activityDate: "2026-03-15",
        season: 2026,
      });

      const all = await testDb.db.select().from(activities);
      expect(all).toHaveLength(2);

      const historical = all.find((a) => a.title === "Historical Run");
      const versioned = all.find((a) => a.title === "New Run");
      expect(historical!.engineVersion).toBeNull();
      expect(versioned!.engineVersion).toBe("1.0");
    });

    it("can query activities by engine version", async () => {
      await createUser(testDb, { name: "Alan" });
      await createActivity(testDb, {
        userId: 1,
        title: "Run A",
        type: "run",
        engineVersion: "1.0",
      });
      await createActivity(testDb, {
        userId: 1,
        title: "Run B",
        type: "run",
        engineVersion: "1.0",
      });
      await createActivity(testDb, {
        userId: 1,
        title: "Run C",
        type: "run",
        engineVersion: "2.0",
      });

      const v1Acts = await testDb.db
        .select()
        .from(activities)
        .where(eq(activities.engineVersion, "1.0"));
      expect(v1Acts).toHaveLength(2);

      const v2Acts = await testDb.db
        .select()
        .from(activities)
        .where(eq(activities.engineVersion, "2.0"));
      expect(v2Acts).toHaveLength(1);
    });

    it("engine_version is preserved through update of other fields", async () => {
      await createUser(testDb, { name: "Alan" });
      await createActivity(testDb, {
        userId: 1,
        title: "Run",
        type: "run",
        engineVersion: "1.0",
        rawPoints: 10,
      });

      // Update points but not engine version
      await testDb.db
        .update(activities)
        .set({ rawPoints: 15, modifiedPoints: 15 })
        .where(eq(activities.id, 1));

      const rows = await testDb.db
        .select()
        .from(activities)
        .where(eq(activities.id, 1));
      expect(rows[0].rawPoints).toBe(15);
      expect(rows[0].engineVersion).toBe("1.0");
    });
  });

  describe("version lookup pattern", () => {
    it("latest version by id DESC matches getCurrentEngineVersion pattern", async () => {
      await testDb.db.insert(scoringEngineVersions).values([
        { version: "1.0", summary: "Initial", effectiveDate: "2022-02-01", createdAt: NOW },
        { version: "1.1", summary: "Updated", effectiveDate: "2025-02-01", createdAt: NOW },
      ]);

      // This is the exact query pattern used by getCurrentEngineVersion()
      const row = await testDb.db
        .select({ version: scoringEngineVersions.version })
        .from(scoringEngineVersions)
        .orderBy(desc(scoringEngineVersions.id))
        .limit(1)
        .get();

      expect(row).toBeDefined();
      expect(row!.version).toBe("1.1");
    });

    it("returns undefined when table is empty (fallback to 1.0)", async () => {
      const row = await testDb.db
        .select({ version: scoringEngineVersions.version })
        .from(scoringEngineVersions)
        .orderBy(desc(scoringEngineVersions.id))
        .limit(1)
        .get();

      // getCurrentEngineVersion() does: row?.version ?? "1.0"
      expect(row).toBeUndefined();
      expect(row?.version ?? "1.0").toBe("1.0");
    });

    it("returns the latest even when versions are not sequential strings", async () => {
      // Version strings could be anything — the id ordering is what matters
      await testDb.db.insert(scoringEngineVersions).values([
        { version: "1.0", summary: "First", effectiveDate: "2022-02-01", createdAt: NOW },
        { version: "1.0.1", summary: "Patch", effectiveDate: "2023-06-01", createdAt: NOW },
        { version: "2.0", summary: "Major", effectiveDate: "2026-02-01", createdAt: NOW },
      ]);

      const row = await testDb.db
        .select({ version: scoringEngineVersions.version })
        .from(scoringEngineVersions)
        .orderBy(desc(scoringEngineVersions.id))
        .limit(1)
        .get();

      expect(row!.version).toBe("2.0");
    });
  });

  describe("full integration: version + activity stamping", () => {
    it("stamps activity with current engine version from DB", async () => {
      await createUser(testDb, { name: "Alan" });

      // Insert engine version
      await testDb.db.insert(scoringEngineVersions).values({
        version: "1.0",
        summary: "Initial",
        effectiveDate: "2022-02-01",
        createdAt: NOW,
      });

      // Simulate what the POST route does: get version, then create activity
      const versionRow = await testDb.db
        .select({ version: scoringEngineVersions.version })
        .from(scoringEngineVersions)
        .orderBy(desc(scoringEngineVersions.id))
        .limit(1)
        .get();
      const engineVersion = versionRow?.version ?? "1.0";

      const act = await createActivity(testDb, {
        userId: 1,
        title: "Versioned Run",
        type: "run",
        engineVersion,
        rawPoints: 20,
        modifiedPoints: 20,
      });

      expect(act.engineVersion).toBe("1.0");
    });

    it("bumping version stamps new activities with new version", async () => {
      await createUser(testDb, { name: "Alan" });

      // v1.0
      await testDb.db.insert(scoringEngineVersions).values({
        version: "1.0",
        summary: "Initial",
        effectiveDate: "2022-02-01",
        createdAt: NOW,
      });

      // Create activity with v1.0
      const getVersion = async () => {
        const row = await testDb.db
          .select({ version: scoringEngineVersions.version })
          .from(scoringEngineVersions)
          .orderBy(desc(scoringEngineVersions.id))
          .limit(1)
          .get();
        return row?.version ?? "1.0";
      };

      const v1 = await getVersion();
      const act1 = await createActivity(testDb, {
        userId: 1,
        title: "Pre-bump Run",
        type: "run",
        engineVersion: v1,
        activityDate: "2026-03-01",
      });

      // Bump to v2.0
      await testDb.db.insert(scoringEngineVersions).values({
        version: "2.0",
        summary: "Child rearing multiplier",
        effectiveDate: "2026-02-01",
        createdAt: NOW,
      });

      // Create activity with v2.0
      const v2 = await getVersion();
      const act2 = await createActivity(testDb, {
        userId: 1,
        title: "Post-bump Run",
        type: "run",
        engineVersion: v2,
        activityDate: "2026-03-15",
      });

      expect(act1.engineVersion).toBe("1.0");
      expect(act2.engineVersion).toBe("2.0");

      // Old activity still has v1.0
      const old = await testDb.db
        .select()
        .from(activities)
        .where(eq(activities.id, act1.id));
      expect(old[0].engineVersion).toBe("1.0");
    });
  });

  describe("off-season scoring rule (Dec 26–31)", () => {
    const baseRules: ActiveRule[] = [
      { ruleType: "base_running", config: { pointsPerMile: 4 } },
      { ruleType: "base_biking", config: { pointsPerMile: 1 } },
      { ruleType: "base_swimming", config: { pointsPerMile: 25 } },
      { ruleType: "weight_training", config: { pointsPer1000Lbs: 0.5 } },
      { ruleType: "elevation_bonus", config: { pointsPerFoot: 0.013, activityType: "run", outdoorOnly: true } },
    ];

    it("scores Dec 25 activity normally", () => {
      const result = scoreActivity(
        { type: "run", isIndoor: false, activityDate: "2026-12-25", distanceMiles: 5 },
        baseRules
      );
      expect(result.rawPoints).toBe(20);
      expect(result.pointBreakdown.base).toBeDefined();
      expect(result.pointBreakdown.offSeason).toBeUndefined();
    });

    it("scores Dec 26 activity as 0 SFUs (off-season)", () => {
      const result = scoreActivity(
        { type: "run", isIndoor: false, activityDate: "2026-12-26", distanceMiles: 5 },
        baseRules
      );
      expect(result.rawPoints).toBe(0);
      expect(result.modifiedPoints).toBe(0);
      expect(result.pointBreakdown.offSeason).toEqual({
        label: "Off-season (Dec 26–31)",
        points: 0,
      });
      expect(result.pointBreakdown.base).toBeUndefined();
    });

    it("scores Dec 27 activity as 0 SFUs", () => {
      const result = scoreActivity(
        { type: "ride", isIndoor: false, activityDate: "2026-12-27", distanceMiles: 20 },
        baseRules
      );
      expect(result.rawPoints).toBe(0);
      expect(result.modifiedPoints).toBe(0);
      expect(result.pointBreakdown.offSeason).toBeDefined();
    });

    it("scores Dec 31 activity as 0 SFUs", () => {
      const result = scoreActivity(
        { type: "swimming", isIndoor: true, activityDate: "2026-12-31", distanceMiles: 1 },
        baseRules
      );
      expect(result.rawPoints).toBe(0);
      expect(result.modifiedPoints).toBe(0);
    });

    it("scores Jan 1 activity normally (not off-season)", () => {
      const result = scoreActivity(
        { type: "run", isIndoor: false, activityDate: "2027-01-01", distanceMiles: 3 },
        baseRules
      );
      expect(result.rawPoints).toBe(12);
    });

    it("applies off-season regardless of activity type", () => {
      const types = [
        { type: "run" as const, distanceMiles: 5 },
        { type: "ride" as const, distanceMiles: 20 },
        { type: "swimming" as const, distanceMiles: 1 },
        { type: "weight_training" as const, poundsLifted: 10000 },
      ];

      for (const t of types) {
        const result = scoreActivity(
          { ...t, isIndoor: false, activityDate: "2026-12-28" },
          baseRules
        );
        expect(result.rawPoints).toBe(0);
        expect(result.pointBreakdown.offSeason).toBeDefined();
      }
    });

    it("applies off-season to any year, not just 2026", () => {
      const result = scoreActivity(
        { type: "run", isIndoor: false, activityDate: "2024-12-30", distanceMiles: 10 },
        baseRules
      );
      expect(result.rawPoints).toBe(0);
    });

    it("scores normally when activityDate is null", () => {
      const result = scoreActivity(
        { type: "run", isIndoor: false, activityDate: null, distanceMiles: 5 },
        baseRules
      );
      expect(result.rawPoints).toBe(20);
    });

    it("scores normally when activityDate is undefined", () => {
      const result = scoreActivity(
        { type: "run", isIndoor: false, distanceMiles: 5 },
        baseRules
      );
      expect(result.rawPoints).toBe(20);
    });
  });
});
