import { describe, it, expect } from "vitest";
import { scoreActivity } from "@/lib/scoring/engine";
import { ALL_RULES } from "../helpers/all-rules";
import type { ScoringInput, ActiveRule } from "@/lib/scoring/types";

describe("scoring edge cases", () => {
  it("zero distance ride scores 0", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false, distanceMiles: 0 };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(0);
  });

  it("large elevation gain calculates correctly", () => {
    const input: ScoringInput = {
      type: "run",
      isIndoor: false,
      distanceMiles: 3,
      elevationGainFeet: 5000,
    };
    const result = scoreActivity(input, ALL_RULES);
    // base: 3, elevation: 5000 * 0.00133333 ≈ 6.67
    expect(result.rawPoints).toBeCloseTo(9.67, 1);
  });

  it("29.9 minutes gives 0 blocks", () => {
    const input: ScoringInput = { type: "yoga", isIndoor: false, durationMinutes: 29.9 };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(0);
  });

  it("only calorie data available (no duration)", () => {
    const input: ScoringInput = {
      type: "swimming",
      isIndoor: false,
      caloriesBurned: 600,
    };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(15); // 600/40
  });

  it("only duration data available (no calories)", () => {
    const input: ScoringInput = {
      type: "hiking",
      isIndoor: false,
      durationMinutes: 120,
    };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(20); // 4 blocks × 5
  });

  it("indoor modifier applied to total including elevation bonus", () => {
    // Use custom rules where elevation applies to all types
    const customRules: ActiveRule[] = [
      { ruleType: "base_running", config: { pointsPerMile: 1 } },
      { ruleType: "elevation_bonus", config: { pointsPerFoot: 0.01 } }, // no outdoorOnly
      { ruleType: "indoor_modifier", config: { multiplier: 0.5 } },
    ];
    const input: ScoringInput = {
      type: "run",
      isIndoor: true,
      distanceMiles: 10,
      elevationGainFeet: 100,
    };
    const result = scoreActivity(input, customRules);
    // base: 10, elevation: 1, raw: 11, modifier: -5.5, modified: 5.5
    expect(result.rawPoints).toBe(11);
    expect(result.modifiedPoints).toBe(5.5);
  });

  it("only base rules active means non-ride/run scores 0", () => {
    const baseOnly: ActiveRule[] = [
      { ruleType: "base_biking", config: { pointsPerMile: 1 } },
      { ruleType: "base_running", config: { pointsPerMile: 1 } },
    ];
    const input: ScoringInput = {
      type: "yoga",
      isIndoor: false,
      durationMinutes: 60,
      caloriesBurned: 300,
    };
    const result = scoreActivity(input, baseOnly);
    expect(result.rawPoints).toBe(0);
  });

  it("walk activity uses general physical scoring", () => {
    const input: ScoringInput = {
      type: "walk",
      isIndoor: false,
      durationMinutes: 90,
      distanceMiles: 3,
    };
    const result = scoreActivity(input, ALL_RULES);
    // Walk is not ride/run, so general_physical: 3 blocks × 5 = 15
    expect(result.rawPoints).toBe(15);
  });
});
