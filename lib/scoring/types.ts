export type ActivityType =
  | "ride"
  | "run"
  | "weight_training"
  | "swimming"
  | "walk"
  | "hiking"
  | "rowing"
  | "yoga"
  | "other";

export type RuleType =
  | "base_biking"
  | "base_running"
  | "indoor_modifier"
  | "elevation_bonus"
  | "general_physical"
  | "calorie_scoring"
  | "handicap"
  | "weight_training";

export interface ScoringInput {
  type: ActivityType;
  isIndoor: boolean;
  distanceMiles?: number | null;
  durationMinutes?: number | null;
  elevationGainFeet?: number | null;
  caloriesBurned?: number | null;
  poundsLifted?: number | null;
}

export interface BreakdownItem {
  label: string;
  points: number;
}

export interface PointBreakdown {
  [key: string]: BreakdownItem;
}

export interface ScoringResult {
  rawPoints: number;
  modifiedPoints: number;
  pointBreakdown: PointBreakdown;
}

export interface RuleConfig {
  pointsPerMile?: number;
  pointsPer30Min?: number;
  multiplier?: number;
  pointsPerFoot?: number;
  activityType?: string;
  outdoorOnly?: boolean;
  caloriesPerPoint?: number;
  pointsPer40Calories?: number;
  pointsPer1000Lbs?: number;
  name?: string;
  description?: string;
}

export interface ActiveRule {
  ruleType: RuleType;
  config: RuleConfig;
}
