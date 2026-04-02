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
    // base: 3 * 4 = 12, elevation: 5000 * 0.013 = 65
    expect(result.rawPoints).toBeCloseTo(77, 1);
  });

  it("swimming with distance scores correctly", () => {
    const input: ScoringInput = {
      type: "swimming",
      isIndoor: false,
      distanceMiles: 0.5,
    };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(12.5); // 0.5 * 25
  });

  it("swimming without distance scores 0", () => {
    const input: ScoringInput = {
      type: "swimming",
      isIndoor: false,
      durationMinutes: 45,
    };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(0);
  });

  it("only base rules active means non-ride/run scores 0", () => {
    const baseOnly: ActiveRule[] = [
      { ruleType: "base_biking", config: { pointsPerMile: 1 } },
      { ruleType: "base_running", config: { pointsPerMile: 4 } },
    ];
    const input: ScoringInput = {
      type: "swimming" as any, // no swimming rule in baseOnly → scores 0
      isIndoor: false,
      durationMinutes: 60,
      caloriesBurned: 300,
    };
    const result = scoreActivity(input, baseOnly);
    expect(result.rawPoints).toBe(0);
  });

  it("weight training with poundsLifted=0 scores 0", () => {
    const input: ScoringInput = {
      type: "weight_training",
      isIndoor: false,
      poundsLifted: 0,
      durationMinutes: 60,
    };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(0);
  });

  it("weight training with only poundsLifted scores correctly", () => {
    const input: ScoringInput = {
      type: "weight_training",
      isIndoor: false,
      poundsLifted: 8000,
    };
    const result = scoreActivity(input, ALL_RULES);
    // 8000/1000 * 0.5 = 4.0
    expect(result.rawPoints).toBe(4);
    expect(result.modifiedPoints).toBe(4);
  });

  it("ride with elevation bonus scores correctly", () => {
    const input: ScoringInput = {
      type: "ride",
      isIndoor: false,
      distanceMiles: 20,
      elevationGainFeet: 1500,
    };
    const result = scoreActivity(input, ALL_RULES);
    // base: 20 * 1 = 20, elevation: 1500 * 0.003 = 4.5
    expect(result.rawPoints).toBeCloseTo(24.5, 1);
  });

  it("indoor activity has no modifier (rawPoints equals modifiedPoints)", () => {
    const input: ScoringInput = {
      type: "ride",
      isIndoor: true,
      distanceMiles: 15,
    };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(15);
    expect(result.modifiedPoints).toBe(15);
  });
});
