import { describe, it, expect } from "vitest";
import { scoreActivity } from "@/lib/scoring/engine";
import { ALL_RULES } from "../helpers/all-rules";
import type { ScoringInput } from "@/lib/scoring/types";

describe("scoreActivity", () => {
  it("scores an outdoor ride", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false, distanceMiles: 18.5 };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(18.5);
    expect(result.modifiedPoints).toBe(18.5);
    expect(result.pointBreakdown.base).toBeDefined();
  });

  it("scores an indoor ride (no modifier)", () => {
    const input: ScoringInput = { type: "ride", isIndoor: true, distanceMiles: 15 };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(15);
    expect(result.modifiedPoints).toBe(15);
  });

  it("scores an outdoor run with elevation", () => {
    const input: ScoringInput = {
      type: "run",
      isIndoor: false,
      distanceMiles: 5.2,
      elevationGainFeet: 320,
    };
    const result = scoreActivity(input, ALL_RULES);
    // 5.2 * 4 = 20.8, 320 * 0.013 = 4.16, total = 24.96
    expect(result.rawPoints).toBe(24.96);
    expect(result.pointBreakdown.base).toBeDefined();
    expect(result.pointBreakdown.elevation).toBeDefined();
    expect(result.modifiedPoints).toBe(result.rawPoints);
  });

  it("scores an indoor run (no elevation bonus due to outdoorOnly)", () => {
    const input: ScoringInput = {
      type: "run",
      isIndoor: true,
      distanceMiles: 5,
      elevationGainFeet: 200,
    };
    const result = scoreActivity(input, ALL_RULES);
    // 5 * 4 = 20 (no elevation for indoor)
    expect(result.rawPoints).toBe(20);
    expect(result.pointBreakdown.elevation).toBeUndefined();
    expect(result.modifiedPoints).toBe(result.rawPoints);
  });

  it("scores an outdoor ride with elevation bonus", () => {
    const input: ScoringInput = {
      type: "ride",
      isIndoor: false,
      distanceMiles: 20,
      elevationGainFeet: 1500,
    };
    const result = scoreActivity(input, ALL_RULES);
    // 20 * 1 = 20, 1500 * 0.003 = 4.5, total = 24.5
    expect(result.rawPoints).toBe(24.5);
    expect(result.pointBreakdown.elevation).toBeDefined();
  });

  it("weight training with poundsLifted uses haybailz scoring", () => {
    const input: ScoringInput = {
      type: "weight_training",
      isIndoor: false,
      poundsLifted: 10000,
    };
    const result = scoreActivity(input, ALL_RULES);
    // 10000 / 1000 * 0.5 = 5.0
    expect(result.rawPoints).toBe(5);
    expect(result.modifiedPoints).toBe(5);
    expect(result.pointBreakdown.base.label).toContain("haybail");
  });

  it("weight training with poundsLifted ignores calories/duration", () => {
    const input: ScoringInput = {
      type: "weight_training",
      isIndoor: false,
      poundsLifted: 2000,
      durationMinutes: 120,
      caloriesBurned: 800,
    };
    const result = scoreActivity(input, ALL_RULES);
    // Should use haybailz: 2000/1000 * 0.5 = 1.0
    expect(result.rawPoints).toBe(1);
    expect(result.pointBreakdown.base.label).toContain("haybail");
  });

  it("swimming scores by distance", () => {
    const input: ScoringInput = {
      type: "swimming",
      isIndoor: false,
      distanceMiles: 1.5,
    };
    const result = scoreActivity(input, ALL_RULES);
    // 1.5 * 25 = 37.5
    expect(result.rawPoints).toBe(37.5);
    expect(result.modifiedPoints).toBe(37.5);
    expect(result.pointBreakdown.base).toBeDefined();
  });

  it("swimming without distance scores 0", () => {
    const input: ScoringInput = {
      type: "swimming",
      isIndoor: false,
      durationMinutes: 45,
      caloriesBurned: 380,
    };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(0);
  });

  it("yoga returns 0 points (no matching rule)", () => {
    const input: ScoringInput = { type: "yoga", isIndoor: true, durationMinutes: 25 };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(0);
    expect(result.modifiedPoints).toBe(0);
  });

  it("returns 0 for empty rules array", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false, distanceMiles: 10 };
    const result = scoreActivity(input, []);
    expect(result.rawPoints).toBe(0);
    expect(result.modifiedPoints).toBe(0);
  });

  it("returns correct breakdown keys", () => {
    const input: ScoringInput = {
      type: "run",
      isIndoor: false,
      distanceMiles: 5,
      elevationGainFeet: 500,
    };
    const result = scoreActivity(input, ALL_RULES);
    expect(Object.keys(result.pointBreakdown)).toContain("base");
    expect(Object.keys(result.pointBreakdown)).toContain("elevation");
  });
});
