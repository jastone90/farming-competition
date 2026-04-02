/**
 * Individual scoring rule calculators.
 *
 * Each function takes a ScoringInput + RuleConfig and returns a BreakdownItem
 * (label + points) or null if the rule doesn't apply to this activity type.
 *
 * Current rules (engine v1.3):
 *   Running:  4 SFU/mile + 4/300 SFU/ft elevation
 *   Cycling:  1 SFU/mile + 1/300 SFU/ft elevation
 *   Swimming: 25 SFU/mile
 *   Weights:  0.5 SFU per haybail (1,000 lbs)
 *   Elevation applies to all activities (indoor and outdoor).
 */
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
  const ppm = config.pointsPerMile ?? 4;
  const points = input.distanceMiles * ppm;
  return {
    label: `${input.distanceMiles.toFixed(1)} mi × ${ppm} pt/mi`,
    points: Math.round(points * 100) / 100,
  };
}

export function calculateBaseSwimming(
  input: ScoringInput,
  config: RuleConfig
): BreakdownItem | null {
  if (input.type !== "swimming" || !input.distanceMiles) return null;
  const ppm = config.pointsPerMile ?? 25;
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
  const ppf = config.pointsPerFoot ?? 0.013;
  const points = input.elevationGainFeet * ppf;
  return {
    label: `${input.elevationGainFeet.toFixed(0)} ft × ${ppf.toFixed(5)}`,
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
