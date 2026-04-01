import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scoringRules } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { scoreActivity } from "@/lib/scoring/engine";
import type { ActiveRule } from "@/lib/scoring/types";

export async function POST(request: Request) {
  const body = await request.json();
  const { type, isIndoor, distanceMiles, durationMinutes, elevationGainFeet, caloriesBurned, poundsLifted } = body;

  const currentYear = new Date().getFullYear();
  const rules = await db
    .select()
    .from(scoringRules)
    .where(sql`${scoringRules.isActive} = 1 AND ${scoringRules.effectiveSeason} <= ${currentYear}`);

  const activeRules: ActiveRule[] = rules.map((r) => ({
    ruleType: r.ruleType,
    config: JSON.parse(r.config),
  }));

  const result = scoreActivity(
    { type, isIndoor: isIndoor || false, distanceMiles, durationMinutes, elevationGainFeet, caloriesBurned, poundsLifted },
    activeRules
  );

  return NextResponse.json(result);
}
