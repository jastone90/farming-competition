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

  it("scores an indoor ride with modifier", () => {
    const input: ScoringInput = { type: "ride", isIndoor: true, distanceMiles: 15 };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(15);
    expect(result.modifiedPoints).toBe(12.45);
    expect(result.pointBreakdown.indoor).toBeDefined();
    expect(result.pointBreakdown.indoor.points).toBeLessThan(0);
  });

  it("scores an outdoor run with elevation", () => {
    const input: ScoringInput = {
      type: "run",
      isIndoor: false,
      distanceMiles: 5.2,
      elevationGainFeet: 320,
    };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBeGreaterThan(5.2);
    expect(result.pointBreakdown.base).toBeDefined();
    expect(result.pointBreakdown.elevation).toBeDefined();
    expect(result.modifiedPoints).toBe(result.rawPoints);
  });

  it("scores an indoor run (no elevation bonus)", () => {
    const input: ScoringInput = {
      type: "run",
      isIndoor: true,
      distanceMiles: 5,
      elevationGainFeet: 200,
    };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(5); // no elevation for indoor
    expect(result.pointBreakdown.elevation).toBeUndefined();
    expect(result.pointBreakdown.indoor).toBeDefined();
    expect(result.modifiedPoints).toBeLessThan(result.rawPoints);
  });

  it("weight training: calorie method wins over time method", () => {
    const input: ScoringInput = {
      type: "weight_training",
      isIndoor: false,
      durationMinutes: 60,
      caloriesBurned: 450,
    };
    const result = scoreActivity(input, ALL_RULES);
    // time: 2 blocks × 5 = 10 pts, calories: 450/40 = 11.25 pts → calorie wins
    expect(result.rawPoints).toBe(11.25);
    expect(result.pointBreakdown.base.label).toContain("calorie method");
  });

  it("weight training: time method wins over calorie method", () => {
    const input: ScoringInput = {
      type: "weight_training",
      isIndoor: false,
      durationMinutes: 90,
      caloriesBurned: 200,
    };
    const result = scoreActivity(input, ALL_RULES);
    // time: 3 blocks × 5 = 15 pts, calories: 200/40 = 5 pts → time wins
    expect(result.rawPoints).toBe(15);
    expect(result.pointBreakdown.base.label).toContain("30-min blocks");
  });

  it("weight training: tie goes to calorie method (>=)", () => {
    const input: ScoringInput = {
      type: "weight_training",
      isIndoor: false,
      durationMinutes: 60,
      caloriesBurned: 400,
    };
    const result = scoreActivity(input, ALL_RULES);
    // time: 2 blocks × 5 = 10, calories: 400/40 = 10 → calorie wins (>=)
    expect(result.rawPoints).toBe(10);
    expect(result.pointBreakdown.base.label).toContain("calorie method");
  });

  it("indoor weight training applies base + indoor modifier", () => {
    const input: ScoringInput = {
      type: "weight_training",
      isIndoor: true,
      durationMinutes: 60,
      caloriesBurned: 450,
    };
    const result = scoreActivity(input, ALL_RULES);
    expect(result.rawPoints).toBe(11.25);
    expect(result.modifiedPoints).toBeLessThan(result.rawPoints);
    expect(result.pointBreakdown.indoor).toBeDefined();
  });

  it("yoga 25min returns 0 points (0 blocks)", () => {
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
    expect(Object.keys(result.pointBreakdown)).not.toContain("indoor");
  });
});
