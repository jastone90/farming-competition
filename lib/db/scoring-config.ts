/**
 * Scoring configuration — tracked in git.
 * This is the source of truth for scoring rules and engine versions.
 *
 * IMPORTANT: When updating rules or versions here, also update
 * lib/db/seed.ts (gitignored) to keep the seed script in sync.
 */

export const scoringRules = [
  {
    ruleType: "base_running",
    config: { pointsPerMile: 4 },
    isActive: true,
    effectiveSeason: 2022,
  },
  {
    ruleType: "base_biking",
    config: { pointsPerMile: 1 },
    isActive: true,
    effectiveSeason: 2022,
  },
  {
    ruleType: "general_physical",
    config: { pointsPer30Min: 5 },
    isActive: false,
    effectiveSeason: 2022,
  },
  {
    ruleType: "indoor_modifier",
    config: { multiplier: 0.83 },
    isActive: false,
    effectiveSeason: 2023,
  },
  {
    ruleType: "elevation_bonus",
    config: { pointsPerFoot: 0.013333, activityType: "run", outdoorOnly: false },
    isActive: true,
    effectiveSeason: 2023,
  },
  {
    ruleType: "calorie_scoring",
    config: { pointsPer40Calories: 1, caloriesPerPoint: 40 },
    isActive: false,
    effectiveSeason: 2024,
  },
  {
    ruleType: "handicap",
    config: { name: "Martin William Paul Ayers Memorial Handicap" },
    isActive: true,
    effectiveSeason: 2024,
  },
  {
    ruleType: "weight_training",
    config: { pointsPer1000Lbs: 0.5 },
    isActive: true,
    effectiveSeason: 2025,
  },
  {
    ruleType: "base_swimming",
    config: { pointsPerMile: 25 },
    isActive: true,
    effectiveSeason: 2025,
  },
  {
    ruleType: "elevation_bonus",
    config: { pointsPerFoot: 0.003333, activityType: "ride", outdoorOnly: false },
    isActive: true,
    effectiveSeason: 2026,
  },
  {
    ruleType: "kidz_multiplier",
    config: { multiplier: 2.5 },
    isActive: true,
    effectiveSeason: 2026,
  },
] as const;

export const engineVersions = [
  {
    version: "1.0",
    summary:
      "Initial engine: running 4 pts/mi, cycling 1 pt/mi, elevation bonuses (run 0.013, ride 0.003), swimming 25 pts/mi, haybailz 0.5 SFU/1000 lbs",
    effectiveDate: "2026-01-01",
  },
  {
    version: "1.1",
    summary: "Off-season rule: activities Dec 26\u201331 score 0 SFUs",
    effectiveDate: "2026-04-02",
  },
  {
    version: "1.2",
    summary:
      "Elevation multipliers corrected: cycling 1/300 pts/ft, running 4/300 pts/ft",
    effectiveDate: "2026-04-02",
  },
  {
    version: "1.3",
    summary:
      "Elevation bonuses apply to all activities (indoor and outdoor)",
    effectiveDate: "2026-04-02",
  },
  {
    version: "1.4",
    summary:
      "Kidz multiplier: 2.5\u00d7 points when exercising with a child",
    effectiveDate: "2026-04-03",
  },
] as const;
