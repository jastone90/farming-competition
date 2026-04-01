import type { ScoringInput, RuleConfig, BreakdownItem } from "./types";

export function calculateBaseBiking(
  input: ScoringInput,
  config: RuleConfig
): BreakdownItem | null {
  if (input.type !== "ride" || !input.distanceMiles) return null;
  const ppm = config.pointsPerMile ?? 1;
  const points = input.distanceMiles * ppm;
  return {
    label: `${input.distanceMiles.toFixed(1)} mi × ${ppm} pt/mi`,
    points: Math.round(points * 100) / 100,
  };
}

export function calculateBaseRunning(
  input: ScoringInput,
  config: RuleConfig
): BreakdownItem | null {
  if (input.type !== "run" || !input.distanceMiles) return null;
  const ppm = config.pointsPerMile ?? 1;
  const points = input.distanceMiles * ppm;
  return {
    label: `${input.distanceMiles.toFixed(1)} mi × ${ppm} pt/mi`,
    points: Math.round(points * 100) / 100,
  };
}

export function calculateElevationBonus(
  input: ScoringInput,
  config: RuleConfig
): BreakdownItem | null {
  if (config.outdoorOnly && input.isIndoor) return null;
  if (config.activityType && input.type !== config.activityType) return null;
  if (!input.elevationGainFeet) return null;
  const ppf = config.pointsPerFoot ?? 0.00133333;
  const points = input.elevationGainFeet * ppf;
  return {
    label: `${input.elevationGainFeet.toFixed(0)} ft × ${ppf.toFixed(5)}`,
    points: Math.round(points * 100) / 100,
  };
}

export function calculateGeneralPhysical(
  input: ScoringInput,
  config: RuleConfig
): BreakdownItem | null {
  if (input.type === "ride" || input.type === "run") return null;
  if (!input.durationMinutes) return null;
  const per30 = config.pointsPer30Min ?? 5;
  const blocks = Math.floor(input.durationMinutes / 30);
  if (blocks <= 0) return null;
  const points = blocks * per30;
  return {
    label: `${blocks} × 30-min blocks × ${per30} pts`,
    points,
  };
}

export function calculateCalorieScoring(
  input: ScoringInput,
  config: RuleConfig
): BreakdownItem | null {
  if (input.type === "ride" || input.type === "run") return null;
  if (!input.caloriesBurned) return null;
  const calPerPt = config.caloriesPerPoint ?? 40;
  const points = input.caloriesBurned / calPerPt;
  return {
    label: `${input.caloriesBurned.toFixed(0)} cal ÷ ${calPerPt} = ${points.toFixed(2)} pts (calorie method)`,
    points: Math.round(points * 100) / 100,
  };
}

export function calculateWeightTraining(
  input: ScoringInput,
  config: RuleConfig
): BreakdownItem | null {
  if (input.type !== "weight_training" || !input.poundsLifted) return null;
  const per1000 = config.pointsPer1000Lbs ?? 0.5;
  const points = (input.poundsLifted / 1000) * per1000;
  return {
    label: `${input.poundsLifted.toFixed(0)} lbs ÷ 1000 × ${per1000} SFU/haybail`,
    points: Math.round(points * 100) / 100,
  };
}

export function applyIndoorModifier(
  input: ScoringInput,
  config: RuleConfig,
  currentPoints: number
): BreakdownItem | null {
  if (!input.isIndoor) return null;
  const mult = config.multiplier ?? 0.83;
  const reduction = currentPoints * (1 - mult);
  return {
    label: `Indoor ${Math.round(mult * 100)}%`,
    points: -Math.round(reduction * 100) / 100,
  };
}
