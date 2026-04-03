import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { createScoringRule } from "../helpers/seed-helpers";
import { getActiveRulesForSeason } from "@/lib/scoring/active-rules";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();

  // Seed scoring rules across multiple seasons
  await createScoringRule(testDb, { ruleType: "base_running", config: JSON.stringify({ pointsPerMile: 4 }), effectiveSeason: 2022 });
  await createScoringRule(testDb, { ruleType: "base_biking", config: JSON.stringify({ pointsPerMile: 1 }), effectiveSeason: 2022 });
  await createScoringRule(testDb, { ruleType: "elevation_bonus", config: JSON.stringify({ pointsPerFoot: 0.013, activityType: "run", outdoorOnly: true }), effectiveSeason: 2023 });
  await createScoringRule(testDb, { ruleType: "handicap", config: JSON.stringify({ name: "Memorial Handicap" }), effectiveSeason: 2024 });
  await createScoringRule(testDb, { ruleType: "base_swimming", config: JSON.stringify({ pointsPerMile: 25 }), effectiveSeason: 2025 });
  await createScoringRule(testDb, { ruleType: "weight_training", config: JSON.stringify({ pointsPer1000Lbs: 0.5 }), effectiveSeason: 2025 });
  await createScoringRule(testDb, { ruleType: "elevation_bonus", config: JSON.stringify({ pointsPerFoot: 0.003, activityType: "ride", outdoorOnly: true }), effectiveSeason: 2026 });
});

afterEach(() => {
  testDb.close();
});

describe("getActiveRulesForSeason — contract tests", () => {
  it("returns ActiveRule[] with ruleType and parsed config", async () => {
    const rules = await getActiveRulesForSeason(2026, testDb.db);
    expect(Array.isArray(rules)).toBe(true);

    for (const rule of rules) {
      expect(rule).toHaveProperty("ruleType");
      expect(rule).toHaveProperty("config");
      expect(typeof rule.ruleType).toBe("string");
      expect(typeof rule.config).toBe("object");
    }
  });

  it("returns fewer rules for earlier seasons", async () => {
    const rules2022 = await getActiveRulesForSeason(2022, testDb.db);
    const rules2026 = await getActiveRulesForSeason(2026, testDb.db);

    // 2026 should have at least as many rules as 2022
    expect(rules2026.length).toBeGreaterThanOrEqual(rules2022.length);
  });

  it("returns empty array for season 0 (no rules effective yet)", async () => {
    const rules = await getActiveRulesForSeason(0, testDb.db);
    expect(rules).toEqual([]);
  });

  it("includes base_running and base_biking for season 2022+", async () => {
    const rules = await getActiveRulesForSeason(2022, testDb.db);
    const types = rules.map((r) => r.ruleType);
    expect(types).toContain("base_running");
    expect(types).toContain("base_biking");
  });

  it("includes swimming and weight_training for season 2025+", async () => {
    const rules = await getActiveRulesForSeason(2025, testDb.db);
    const types = rules.map((r) => r.ruleType);
    expect(types).toContain("base_swimming");
    expect(types).toContain("weight_training");
  });
});
