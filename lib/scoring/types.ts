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
  | "base_swimming"
  | "elevation_bonus"
  | "handicap"
  | "weight_training";

export interface ScoringInput {
  type: ActivityType;
  isIndoor: boolean;
  activityDate?: string | null;
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
  pointsPerFoot?: number;
  activityType?: string;
  outdoorOnly?: boolean;
  pointsPer1000Lbs?: number;
  name?: string;
  description?: string;
}

export interface ActiveRule {
  ruleType: RuleType;
  config: RuleConfig;
}
