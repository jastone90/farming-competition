import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { createScoringRule } from "../helpers/seed-helpers";
import { getActiveRulesForSeason } from "@/lib/scoring/active-rules";

// The active-rules module imports from @/lib/db which returns the real DB.
// For unit testing, we test the query logic indirectly through the seed-helpers
// and test-db. For the shared utility, we verify the contract:
// given rules in a DB, getActiveRulesForSeason returns correctly typed results.
//
// NOTE: These tests use the REAL db singleton, so they require the actual
// farming.db to have been seeded. For pure isolation, the DB module
// would need dependency injection. This is a pragmatic integration test.

describe("getActiveRulesForSeason — contract tests", () => {
  it("returns ActiveRule[] with ruleType and parsed config", async () => {
    // This calls the real DB — requires farming.db to be seeded
    const rules = await getActiveRulesForSeason(2026);
    expect(Array.isArray(rules)).toBe(true);

    for (const rule of rules) {
      expect(rule).toHaveProperty("ruleType");
      expect(rule).toHaveProperty("config");
      expect(typeof rule.ruleType).toBe("string");
      expect(typeof rule.config).toBe("object");
    }
  });

  it("returns fewer rules for earlier seasons", async () => {
    const rules2022 = await getActiveRulesForSeason(2022);
    const rules2026 = await getActiveRulesForSeason(2026);

    // 2026 should have at least as many rules as 2022
    expect(rules2026.length).toBeGreaterThanOrEqual(rules2022.length);
  });

  it("returns empty array for season 0 (no rules effective yet)", async () => {
    const rules = await getActiveRulesForSeason(0);
    expect(rules).toEqual([]);
  });

  it("includes base_running and base_biking for season 2022+", async () => {
    const rules = await getActiveRulesForSeason(2022);
    const types = rules.map((r) => r.ruleType);
    expect(types).toContain("base_running");
    expect(types).toContain("base_biking");
  });

  it("includes swimming and weight_training for season 2025+", async () => {
    const rules = await getActiveRulesForSeason(2025);
    const types = rules.map((r) => r.ruleType);
    expect(types).toContain("base_swimming");
    expect(types).toContain("weight_training");
  });
});
