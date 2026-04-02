import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, activities, scoringRules } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getStravaActivities, refreshTokenIfNeeded } from "@/lib/strava/client";
import { mapStravaActivity } from "@/lib/strava/mapper";
import { scoreActivity } from "@/lib/scoring/engine";
import type { ActiveRule } from "@/lib/scoring/types";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await db.select().from(users).where(eq(users.id, session.id)).get();
  if (!user?.stravaAccessToken || !user?.stravaRefreshToken || !user?.stravaTokenExpiresAt) {
    return NextResponse.json({ error: "Strava not connected" }, { status: 400 });
  }

  const tokens = await refreshTokenIfNeeded(
    user.stravaAccessToken,
    user.stravaRefreshToken,
    user.stravaTokenExpiresAt
  );

  if (!tokens) {
    return NextResponse.json({ error: "Token refresh failed" }, { status: 500 });
  }

  // Update tokens
  if (tokens.accessToken !== user.stravaAccessToken) {
    await db
      .update(users)
      .set({
        stravaAccessToken: tokens.accessToken,
        stravaRefreshToken: tokens.refreshToken,
        stravaTokenExpiresAt: tokens.expiresAt,
      })
      .where(eq(users.id, user.id));
  }

  let imported = 0;
  let page = 1;

  while (page <= 5) {
    const stravaActivities = await getStravaActivities(tokens.accessToken, page, 30);
    if (!stravaActivities.length) break;

    for (const sa of stravaActivities) {
      const existing = await db
        .select()
        .from(activities)
        .where(eq(activities.stravaActivityId, String(sa.id)))
        .get();

      if (existing) continue;

      const mapped = mapStravaActivity(sa);
      if (!mapped) continue; // unsupported activity type

      const rules = await db
        .select()
        .from(scoringRules)
        .where(sql`${scoringRules.isActive} = 1 AND ${scoringRules.effectiveSeason} <= ${mapped.season}`);

      const activeRules: ActiveRule[] = rules.map((r) => ({
        ruleType: r.ruleType,
        config: JSON.parse(r.config),
      }));

      const result = scoreActivity(
        {
          type: mapped.type,
          isIndoor: mapped.isIndoor,
          distanceMiles: mapped.distanceMiles,
          durationMinutes: mapped.durationMinutes,
          elevationGainFeet: mapped.elevationGainFeet,
          caloriesBurned: mapped.caloriesBurned,
        },
        activeRules
      );

      await db.insert(activities).values({
        userId: user.id,
        source: "strava",
        ...mapped,
        rawPoints: result.rawPoints,
        modifiedPoints: result.modifiedPoints,
        pointBreakdown: JSON.stringify(result.pointBreakdown),
      });

      imported++;
    }

    page++;
  }

  return NextResponse.json({ imported });
}
