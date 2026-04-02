/**
 * Scoring engine — the core of the competition.
 *
 * Takes an activity + active rules and produces points with a transparent breakdown.
 * Two-pass design: base rules first (distance × rate), then elevation bonuses.
 * Off-season rule (Dec 26–31) short-circuits to 0 before any calculations.
 *
 * @see lib/scoring/rules.ts — individual rule calculators
 * @see lib/scoring/types.ts — TypeScript interfaces
 * @see lib/db/scoring-config.ts — rule definitions (source of truth)
 */
import type { ScoringInput, ActiveRule, ScoringResult, PointBreakdown } from "./types";
import {
  calculateBaseBiking,
  calculateBaseRunning,
  calculateBaseSwimming,
  calculateElevationBonus,
  calculateWeightTraining,
} from "./rules";
import { db } from "@/lib/db";
import { scoringEngineVersions } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

/** Returns the latest engine version string from the DB, or "1.0" as fallback. */
export async function getCurrentEngineVersion(): Promise<string> {
  const row = await db
    .select({ version: scoringEngineVersions.version })
    .from(scoringEngineVersions)
    .orderBy(desc(scoringEngineVersions.id))
    .limit(1)
    .get();
  return row?.version ?? "1.0";
}

/**
 * Score a single activity against the active rules.
 * Returns raw points, modified points (currently equal), and a breakdown object
 * that explains exactly how the score was calculated.
 */
export function scoreActivity(
  input: ScoringInput,
  rules: ActiveRule[]
): ScoringResult {
  // Dec 26–31 is off-season: activities score 0 SFUs
  if (input.activityDate) {
    const d = new Date(input.activityDate + "T00:00:00");
    if (d.getMonth() === 11 && d.getDate() >= 26) {
      return {
        rawPoints: 0,
        modifiedPoints: 0,
        pointBreakdown: {
          offSeason: { label: "Off-season (Dec 26–31)", points: 0 },
        },
      };
    }
  }

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
