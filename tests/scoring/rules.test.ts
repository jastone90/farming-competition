import { describe, it, expect } from "vitest";
import {
  calculateBaseBiking,
  calculateBaseRunning,
  calculateBaseSwimming,
  calculateElevationBonus,
  calculateWeightTraining,
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
  const config: RuleConfig = { pointsPerMile: 4 };

  it("returns points for a run with distance", () => {
    const input: ScoringInput = { type: "run", isIndoor: false, distanceMiles: 5.2 };
    const result = calculateBaseRunning(input, config);
    expect(result).not.toBeNull();
    expect(result!.points).toBe(20.8);
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

describe("calculateBaseSwimming", () => {
  const config: RuleConfig = { pointsPerMile: 25 };

  it("returns points for swimming with distance", () => {
    const input: ScoringInput = { type: "swimming", isIndoor: false, distanceMiles: 1.0 };
    const result = calculateBaseSwimming(input, config);
    expect(result).not.toBeNull();
    expect(result!.points).toBe(25);
    expect(result!.label).toContain("25");
  });

  it("returns null for non-swimming type", () => {
    const input: ScoringInput = { type: "run", isIndoor: false, distanceMiles: 1 };
    expect(calculateBaseSwimming(input, config)).toBeNull();
  });

  it("returns null when distance is null", () => {
    const input: ScoringInput = { type: "swimming", isIndoor: false, distanceMiles: null };
    expect(calculateBaseSwimming(input, config)).toBeNull();
  });

  it("returns null when distance is 0", () => {
    const input: ScoringInput = { type: "swimming", isIndoor: false, distanceMiles: 0 };
    expect(calculateBaseSwimming(input, config)).toBeNull();
  });
});

describe("calculateElevationBonus", () => {
  const config: RuleConfig = { pointsPerFoot: 0.013, activityType: "run", outdoorOnly: true };

  it("returns bonus for outdoor run with elevation", () => {
    const input: ScoringInput = { type: "run", isIndoor: false, elevationGainFeet: 750 };
    const result = calculateElevationBonus(input, config);
    expect(result).not.toBeNull();
    expect(result!.points).toBe(9.75); // 750 * 0.013
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

describe("calculateWeightTraining", () => {
  const config: RuleConfig = { pointsPer1000Lbs: 0.5 };

  it("returns 0.5 SFU per 1000 lbs (1 haybail)", () => {
    const input: ScoringInput = { type: "weight_training", isIndoor: false, poundsLifted: 1000 };
    const result = calculateWeightTraining(input, config);
    expect(result).not.toBeNull();
    expect(result!.points).toBe(0.5);
    expect(result!.label).toContain("1000");
    expect(result!.label).toContain("haybail");
  });

  it("scores 15000 lbs as 7.5 SFU", () => {
    const input: ScoringInput = { type: "weight_training", isIndoor: false, poundsLifted: 15000 };
    const result = calculateWeightTraining(input, config);
    expect(result!.points).toBe(7.5);
  });

  it("returns null for non-weight_training type", () => {
    const input: ScoringInput = { type: "run", isIndoor: false, poundsLifted: 5000 };
    expect(calculateWeightTraining(input, config)).toBeNull();
  });

  it("returns null when poundsLifted is null", () => {
    const input: ScoringInput = { type: "weight_training", isIndoor: false, poundsLifted: null };
    expect(calculateWeightTraining(input, config)).toBeNull();
  });

  it("returns null when poundsLifted is undefined", () => {
    const input: ScoringInput = { type: "weight_training", isIndoor: false };
    expect(calculateWeightTraining(input, config)).toBeNull();
  });

  it("returns null when poundsLifted is 0", () => {
    const input: ScoringInput = { type: "weight_training", isIndoor: false, poundsLifted: 0 };
    expect(calculateWeightTraining(input, config)).toBeNull();
  });

  it("uses custom pointsPer1000Lbs", () => {
    const input: ScoringInput = { type: "weight_training", isIndoor: false, poundsLifted: 2000 };
    const result = calculateWeightTraining(input, { pointsPer1000Lbs: 1 });
    expect(result!.points).toBe(2);
  });

  it("rounds to 2 decimal places", () => {
    const input: ScoringInput = { type: "weight_training", isIndoor: false, poundsLifted: 3333 };
    const result = calculateWeightTraining(input, config);
    // 3333 / 1000 * 0.5 = 1.6665 → rounds to 1.67
    expect(result!.points).toBe(1.67);
  });
});
