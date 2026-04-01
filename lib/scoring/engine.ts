import type { ScoringInput, ActiveRule, ScoringResult, PointBreakdown } from "./types";
import {
  calculateBaseBiking,
  calculateBaseRunning,
  calculateElevationBonus,
  calculateGeneralPhysical,
  calculateCalorieScoring,
  calculateWeightTraining,
  applyIndoorModifier,
} from "./rules";

export function scoreActivity(
  input: ScoringInput,
  rules: ActiveRule[]
): ScoringResult {
  const breakdown: PointBreakdown = {};
  let basePoints = 0;

  // Step 1: Calculate base points (mileage-based for ride/run)
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
  }

  // Step 2: For weight_training, use dedicated haybailz scoring
  if (input.type === "weight_training") {
    for (const rule of rules) {
      if (rule.ruleType === "weight_training") {
        const result = calculateWeightTraining(input, rule.config);
        if (result) {
          breakdown.base = result;
          basePoints += result.points;
        }
      }
    }
    // Fall back to general_physical/calorie if no weight_training rule matched
    if (!breakdown.base) {
      let timeResult = null;
      let calResult = null;
      for (const rule of rules) {
        if (rule.ruleType === "general_physical") {
          timeResult = calculateGeneralPhysical(input, rule.config);
        }
        if (rule.ruleType === "calorie_scoring") {
          calResult = calculateCalorieScoring(input, rule.config);
        }
      }
      if (timeResult && calResult) {
        if (calResult.points >= timeResult.points) {
          breakdown.base = calResult;
          basePoints += calResult.points;
        } else {
          breakdown.base = timeResult;
          basePoints += timeResult.points;
        }
      } else if (calResult) {
        breakdown.base = calResult;
        basePoints += calResult.points;
      } else if (timeResult) {
        breakdown.base = timeResult;
        basePoints += timeResult.points;
      }
    }
  }

  // Step 3: For other non-ride/run, use the better of 30-min blocks vs calories
  if (input.type !== "ride" && input.type !== "run" && input.type !== "weight_training") {
    let timeResult = null;
    let calResult = null;

    for (const rule of rules) {
      if (rule.ruleType === "general_physical") {
        timeResult = calculateGeneralPhysical(input, rule.config);
      }
      if (rule.ruleType === "calorie_scoring") {
        calResult = calculateCalorieScoring(input, rule.config);
      }
    }

    // Use whichever gives more points
    if (timeResult && calResult) {
      if (calResult.points >= timeResult.points) {
        breakdown.base = calResult;
        basePoints += calResult.points;
      } else {
        breakdown.base = timeResult;
        basePoints += timeResult.points;
      }
    } else if (calResult) {
      breakdown.base = calResult;
      basePoints += calResult.points;
    } else if (timeResult) {
      breakdown.base = timeResult;
      basePoints += timeResult.points;
    }
  }

  // Step 4: Apply elevation bonus
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
  let modifiedPoints = rawPoints;

  // Step 5: Apply indoor modifier
  for (const rule of rules) {
    if (rule.ruleType === "indoor_modifier") {
      const result = applyIndoorModifier(input, rule.config, rawPoints);
      if (result) {
        breakdown.indoor = result;
        modifiedPoints = Math.round((modifiedPoints + result.points) * 100) / 100;
      }
    }
  }

  return {
    rawPoints,
    modifiedPoints,
    pointBreakdown: breakdown,
  };
}
