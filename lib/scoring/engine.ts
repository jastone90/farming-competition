import type { ScoringInput, ActiveRule, ScoringResult, PointBreakdown } from "./types";
import {
  calculateBaseBiking,
  calculateBaseRunning,
  calculateBaseSwimming,
  calculateElevationBonus,
  calculateWeightTraining,
} from "./rules";

export function scoreActivity(
  input: ScoringInput,
  rules: ActiveRule[]
): ScoringResult {
  const breakdown: PointBreakdown = {};
  let basePoints = 0;

  for (const rule of rules) {
    if (rule.ruleType === "base_biking") {
      const result = calculateBaseBiking(input, rule.config);
      if (result) {
        breakdown.base = result;
        basePoints += result.points;
      }
    }
    if (rule.ruleType === "base_running") {
      const result = calculateBaseRunning(input, rule.config);
      if (result) {
        breakdown.base = result;
        basePoints += result.points;
      }
    }
    if (rule.ruleType === "base_swimming") {
      const result = calculateBaseSwimming(input, rule.config);
      if (result) {
        breakdown.base = result;
        basePoints += result.points;
      }
    }
    if (rule.ruleType === "weight_training") {
      const result = calculateWeightTraining(input, rule.config);
      if (result) {
        breakdown.base = result;
        basePoints += result.points;
      }
    }
  }

  // Apply elevation bonus
  for (const rule of rules) {
    if (rule.ruleType === "elevation_bonus") {
      const result = calculateElevationBonus(input, rule.config);
      if (result) {
        breakdown.elevation = result;
        basePoints += result.points;
      }
    }
  }

  const rawPoints = Math.round(basePoints * 100) / 100;

  return {
    rawPoints,
    modifiedPoints: rawPoints,
    pointBreakdown: breakdown,
  };
}
