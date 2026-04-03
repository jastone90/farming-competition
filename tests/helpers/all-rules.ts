import type { ActiveRule } from "@/lib/scoring/types";

export const ALL_RULES: ActiveRule[] = [
  { ruleType: "base_biking", config: { pointsPerMile: 1 } },
  { ruleType: "base_running", config: { pointsPerMile: 4 } },
  { ruleType: "base_swimming", config: { pointsPerMile: 25 } },
  {
    ruleType: "elevation_bonus",
    config: { pointsPerFoot: 0.013, activityType: "run", outdoorOnly: true },
  },
  {
    ruleType: "elevation_bonus",
    config: { pointsPerFoot: 0.003, activityType: "ride", outdoorOnly: true },
  },
  {
    ruleType: "handicap",
    config: {
      name: "Martin Memorial Handicap",
      description: "Handicap system - mechanics configurable",
    },
  },
  { ruleType: "weight_training", config: { pointsPer1000Lbs: 0.5 } },
];
