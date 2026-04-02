import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scoringRules, amendments } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  const rules = await db
    .select({
      id: scoringRules.id,
      ruleType: scoringRules.ruleType,
      config: scoringRules.config,
      isActive: scoringRules.isActive,
      effectiveSeason: scoringRules.effectiveSeason,
      amendmentId: scoringRules.amendmentId,
    })
    .from(scoringRules)
    .where(eq(scoringRules.isActive, true));

  const parsed = rules.map((r) => ({
    ...r,
    config: JSON.parse(r.config),
  }));

  return NextResponse.json(parsed);
}
