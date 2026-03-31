import { describe, it, expect } from "vitest";
import {
  calculateBaseBiking,
  calculateBaseRunning,
  calculateElevationBonus,
  calculateGeneralPhysical,
  calculateCalorieScoring,
  applyIndoorModifier,
} from "@/lib/scoring/rules";
import type { ScoringInput, RuleConfig } from "@/lib/scoring/types";

describe("calculateBaseBiking", () => {
  const config: RuleConfig = { pointsPerMile: 1 };

  it("returns points for a ride with distance", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false, distanceMiles: 18.5 };
    const result = calculateBaseBiking(input, config);
    expect(result).not.toBeNull();
    expect(result!.points).toBe(18.5);
    expect(result!.label).toContain("18.5");
  });

  it("returns null for non-ride type", () => {
    const input: ScoringInput = { type: "run", isIndoor: false, distanceMiles: 10 };
    expect(calculateBaseBiking(input, config)).toBeNull();
  });

  it("returns null when distance is null", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false, distanceMiles: null };
    expect(calculateBaseBiking(input, config)).toBeNull();
  });

  it("returns null when distance is undefined", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false };
    expect(calculateBaseBiking(input, config)).toBeNull();
  });

  it("returns null when distance is 0", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false, distanceMiles: 0 };
    expect(calculateBaseBiking(input, config)).toBeNull();
  });

  it("uses custom pointsPerMile", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false, distanceMiles: 10 };
    const result = calculateBaseBiking(input, { pointsPerMile: 2 });
    expect(result!.points).toBe(20);
  });
});

describe("calculateBaseRunning", () => {
  const config: RuleConfig = { pointsPerMile: 1 };

  it("returns points for a run with distance", () => {
    const input: ScoringInput = { type: "run", isIndoor: false, distanceMiles: 5.2 };
    const result = calculateBaseRunning(input, config);
    expect(result).not.toBeNull();
    expect(result!.points).toBe(5.2);
  });

  it("returns null for non-run type", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false, distanceMiles: 10 };
    expect(calculateBaseRunning(input, config)).toBeNull();
  });

  it("returns null when distance is null", () => {
    const input: ScoringInput = { type: "run", isIndoor: false, distanceMiles: null };
    expect(calculateBaseRunning(input, config)).toBeNull();
  });
});

describe("calculateElevationBonus", () => {
  const config: RuleConfig = { pointsPerFoot: 0.00133333, activityType: "run", outdoorOnly: true };

  it("returns bonus for outdoor run with elevation", () => {
    const input: ScoringInput = { type: "run", isIndoor: false, elevationGainFeet: 750 };
    const result = calculateElevationBonus(input, config);
    expect(result).not.toBeNull();
    expect(result!.points).toBe(1); // 750 * 0.00133333 ≈ 1.0
  });

  it("returns null for indoor run (outdoorOnly)", () => {
    const input: ScoringInput = { type: "run", isIndoor: true, elevationGainFeet: 500 };
    expect(calculateElevationBonus(input, config)).toBeNull();
  });

  it("returns null for non-run type when activityType is set", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false, elevationGainFeet: 500 };
    expect(calculateElevationBonus(input, config)).toBeNull();
  });

  it("returns null when elevation is null", () => {
    const input: ScoringInput = { type: "run", isIndoor: false, elevationGainFeet: null };
    expect(calculateElevationBonus(input, config)).toBeNull();
  });

  it("returns null when elevation is 0", () => {
    const input: ScoringInput = { type: "run", isIndoor: false, elevationGainFeet: 0 };
    expect(calculateElevationBonus(input, config)).toBeNull();
  });
});

describe("calculateGeneralPhysical", () => {
  const config: RuleConfig = { pointsPer30Min: 5 };

  it("returns 10 for 60 minutes (2 blocks)", () => {
    const input: ScoringInput = { type: "weight_training", isIndoor: true, durationMinutes: 60 };
    const result = calculateGeneralPhysical(input, config);
    expect(result!.points).toBe(10);
    expect(result!.label).toContain("2");
  });

  it("returns 5 for 45 minutes (1 block)", () => {
    const input: ScoringInput = { type: "yoga", isIndoor: true, durationMinutes: 45 };
    const result = calculateGeneralPhysical(input, config);
    expect(result!.points).toBe(5);
  });

  it("returns null for less than 30 minutes", () => {
    const input: ScoringInput = { type: "yoga", isIndoor: true, durationMinutes: 25 };
    expect(calculateGeneralPhysical(input, config)).toBeNull();
  });

  it("returns null for ride type", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false, durationMinutes: 60 };
    expect(calculateGeneralPhysical(input, config)).toBeNull();
  });

  it("returns null for run type", () => {
    const input: ScoringInput = { type: "run", isIndoor: false, durationMinutes: 60 };
    expect(calculateGeneralPhysical(input, config)).toBeNull();
  });
});

describe("calculateCalorieScoring", () => {
  const config: RuleConfig = { caloriesPerPoint: 40 };

  it("returns 10 for 400 calories", () => {
    const input: ScoringInput = { type: "weight_training", isIndoor: true, caloriesBurned: 400 };
    const result = calculateCalorieScoring(input, config);
    expect(result!.points).toBe(10);
    expect(result!.label).toContain("calorie method");
  });

  it("returns null for ride type", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false, caloriesBurned: 400 };
    expect(calculateCalorieScoring(input, config)).toBeNull();
  });

  it("returns null for run type", () => {
    const input: ScoringInput = { type: "run", isIndoor: false, caloriesBurned: 400 };
    expect(calculateCalorieScoring(input, config)).toBeNull();
  });

  it("returns null when calories is null", () => {
    const input: ScoringInput = { type: "yoga", isIndoor: true, caloriesBurned: null };
    expect(calculateCalorieScoring(input, config)).toBeNull();
  });

  it("returns null when calories is undefined", () => {
    const input: ScoringInput = { type: "yoga", isIndoor: true };
    expect(calculateCalorieScoring(input, config)).toBeNull();
  });
});

describe("applyIndoorModifier", () => {
  const config: RuleConfig = { multiplier: 0.83 };

  it("applies 17% reduction for indoor activity", () => {
    const input: ScoringInput = { type: "ride", isIndoor: true };
    const result = applyIndoorModifier(input, config, 100);
    expect(result).not.toBeNull();
    expect(result!.points).toBe(-17);
    expect(result!.label).toContain("83%");
  });

  it("returns null for outdoor activity", () => {
    const input: ScoringInput = { type: "ride", isIndoor: false };
    expect(applyIndoorModifier(input, config, 100)).toBeNull();
  });
});
