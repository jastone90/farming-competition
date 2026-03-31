import type { ActiveRule } from "@/lib/scoring/types";

export const ALL_RULES: ActiveRule[] = [
  { ruleType: "base_biking", config: { pointsPerMile: 1 } },
  { ruleType: "base_running", config: { pointsPerMile: 1 } },
  { ruleType: "general_physical", config: { pointsPer30Min: 5 } },
  { ruleType: "indoor_modifier", config: { multiplier: 0.83 } },
  {
    ruleType: "elevation_bonus",
    config: { pointsPerFoot: 0.00133333, activityType: "run", outdoorOnly: true },
  },
  { ruleType: "calorie_scoring", config: { caloriesPerPoint: 40 } },
  {
    ruleType: "handicap",
    config: {
      name: "Martin William Paul Ayers Memorial Handicap",
      description: "Handicap system - mechanics configurable",
    },
  },
];
