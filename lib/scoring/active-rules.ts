/**
 * Shared helper to fetch active scoring rules for a given season.
 *
 * Used by: Strava sync, Strava webhook, manual activity creation (POST /api/activities).
 * If you change the scoring rule query logic, update it HERE — all consumers share this.
 *
 * @see lib/db/scoring-config.ts — source of truth for rule definitions (tracked in git)
 * @see lib/db/seed.ts — seeds rules into the database (gitignored, contains personal data)
 */
import { db as defaultDb } from "@/lib/db";
import { scoringRules } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import type { ActiveRule } from "@/lib/scoring/types";

export async function getActiveRulesForSeason(season: number, db = defaultDb): Promise<ActiveRule[]> {
  const rules = await db
    .select()
    .from(scoringRules)
    .where(sql`${scoringRules.isActive} = 1 AND ${scoringRules.effectiveSeason} <= ${season}`);

  return rules.map((r) => ({
    ruleType: r.ruleType,
    config: JSON.parse(r.config),
  }));
}
