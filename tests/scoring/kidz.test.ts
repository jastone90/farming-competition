import { describe, it, expect } from "vitest";
import { scoreActivity } from "@/lib/scoring/engine";
import type { ScoringInput, ActiveRule } from "@/lib/scoring/types";

const baseRules: ActiveRule[] = [
  { ruleType: "base_running", config: { pointsPerMile: 4 } },
  { ruleType: "base_biking", config: { pointsPerMile: 1 } },
  { ruleType: "base_swimming", config: { pointsPerMile: 25 } },
  { ruleType: "weight_training", config: { pointsPer1000Lbs: 0.5 } },
  {
    ruleType: "elevation_bonus",
    config: { pointsPerFoot: 0.013333, activityType: "run", outdoorOnly: false },
  },
  {
    ruleType: "elevation_bonus",
    config: { pointsPerFoot: 0.003333, activityType: "ride", outdoorOnly: false },
  },
];

describe("Kidz multiplier (2.5×)", () => {
  it("applies 2.5× to a running activity", () => {
    const input: ScoringInput = {
      type: "run",
      isIndoor: false,
      distanceMiles: 5,
      activityDate: "2026-03-15",
      withChild: true,
    };
    const result = scoreActivity(input, baseRules);
    // Base: 5 × 4 = 20, then × 2.5 = 50
    expect(result.rawPoints).toBe(50);
    expect(result.pointBreakdown.kidz).toBeDefined();
    expect(result.pointBreakdown.kidz.points).toBe(30); // bonus added = 20 * 1.5
  });

  it("applies 2.5× to a biking activity", () => {
    const input: ScoringInput = {
      type: "ride",
      isIndoor: false,
      distanceMiles: 20,
      activityDate: "2026-06-01",
      withChild: true,
    };
    const result = scoreActivity(input, baseRules);
    // Base: 20 × 1 = 20, then × 2.5 = 50
    expect(result.rawPoints).toBe(50);
  });

  it("applies 2.5× to swimming", () => {
    const input: ScoringInput = {
      type: "swimming",
      isIndoor: true,
      distanceMiles: 1,
      activityDate: "2026-06-01",
      withChild: true,
    };
    const result = scoreActivity(input, baseRules);
    // Base: 1 × 25 = 25, then × 2.5 = 62.5
    expect(result.rawPoints).toBe(62.5);
  });

  it("applies 2.5× to weight training", () => {
    const input: ScoringInput = {
      type: "weight_training",
      isIndoor: true,
      poundsLifted: 10000,
      activityDate: "2026-06-01",
      withChild: true,
    };
    const result = scoreActivity(input, baseRules);
    // Base: 10000/1000 * 0.5 = 5, then × 2.5 = 12.5
    expect(result.rawPoints).toBe(12.5);
  });

  it("stacks with elevation bonus (base + elevation, then × 2.5)", () => {
    const input: ScoringInput = {
      type: "run",
      isIndoor: false,
      distanceMiles: 5,
      elevationGainFeet: 300,
      activityDate: "2026-03-15",
      withChild: true,
    };
    const result = scoreActivity(input, baseRules);
    // Base: 5 × 4 = 20, Elev: 300 × 0.013333 = 4.0 (rounded)
    // Total before kidz: 24.0, then × 2.5 = 60.0
    const baseBeforeKidz = 20 + 300 * 0.013333;
    const expected = Math.round(baseBeforeKidz * 2.5 * 100) / 100;
    expect(result.rawPoints).toBe(expected);
    expect(result.pointBreakdown.elevation).toBeDefined();
    expect(result.pointBreakdown.kidz).toBeDefined();
  });

  it("withChild: false produces same score as omitting it", () => {
    const base: ScoringInput = {
      type: "run",
      isIndoor: false,
      distanceMiles: 5,
      activityDate: "2026-03-15",
    };
    const withFalse: ScoringInput = { ...base, withChild: false };

    const r1 = scoreActivity(base, baseRules);
    const r2 = scoreActivity(withFalse, baseRules);
    expect(r1.rawPoints).toBe(r2.rawPoints);
    expect(r1.pointBreakdown.kidz).toBeUndefined();
    expect(r2.pointBreakdown.kidz).toBeUndefined();
  });

  it("off-season + withChild still scores 0", () => {
    const input: ScoringInput = {
      type: "run",
      isIndoor: false,
      distanceMiles: 5,
      activityDate: "2026-12-27",
      withChild: true,
    };
    const result = scoreActivity(input, baseRules);
    expect(result.rawPoints).toBe(0);
    expect(result.pointBreakdown.offSeason).toBeDefined();
    expect(result.pointBreakdown.kidz).toBeUndefined();
  });

  it("breakdown includes kidz entry with correct label when active", () => {
    const input: ScoringInput = {
      type: "ride",
      isIndoor: false,
      distanceMiles: 10,
      activityDate: "2026-06-01",
      withChild: true,
    };
    const result = scoreActivity(input, baseRules);
    expect(result.pointBreakdown.kidz.label).toBe("Kidz multiplier (2.5×)");
    // Base: 10, kidz bonus = 10 * 1.5 = 15
    expect(result.pointBreakdown.kidz.points).toBe(15);
    expect(result.rawPoints).toBe(25);
  });
});
