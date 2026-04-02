import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, activities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getStravaActivities } from "@/lib/strava/client";
import { ensureFreshTokens } from "@/lib/strava/token-manager";
import { mapStravaActivity } from "@/lib/strava/mapper";
import { scoreActivity, getCurrentEngineVersion } from "@/lib/scoring/engine";
import { getActiveRulesForSeason } from "@/lib/scoring/active-rules";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await db.select().from(users).where(eq(users.id, session.id)).get();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const accessToken = await ensureFreshTokens(user);
  if (!accessToken) {
    return NextResponse.json({ error: "Strava not connected or token refresh failed" }, { status: 400 });
  }

  const engineVersion = await getCurrentEngineVersion();

  // Fetch rules once per season (cached in Map to avoid N+1 queries)
  const rulesCache = new Map();

  const now = new Date();
  const after = Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000);

  let imported = 0;
  let skipped = 0;
  const skippedTypes: Record<string, number> = {};
  const importedTypes: Record<string, number> = {};
  let page = 1;

  while (true) {
    const stravaActivities = await getStravaActivities(accessToken, page, 30, after);
    if (!stravaActivities.length) break;

    for (const sa of stravaActivities) {
      const existing = await db
        .select()
        .from(activities)
        .where(eq(activities.stravaActivityId, String(sa.id)))
        .get();

      if (existing) continue;

      const mapped = mapStravaActivity(sa);
      if (!mapped) {
        skipped++;
        skippedTypes[sa.type] = (skippedTypes[sa.type] || 0) + 1;
        continue;
      }

      // Get rules for this season (cached to avoid repeated DB queries)
      if (!rulesCache.has(mapped.season)) {
        rulesCache.set(mapped.season, await getActiveRulesForSeason(mapped.season));
      }
      const activeRules = rulesCache.get(mapped.season);

      const result = scoreActivity(
        {
          type: mapped.type,
          isIndoor: mapped.isIndoor,
          activityDate: mapped.activityDate,
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
        engineVersion,
      });

      importedTypes[mapped.type] = (importedTypes[mapped.type] || 0) + 1;
      imported++;
    }

    page++;
  }

  return NextResponse.json({ imported, skipped, skippedTypes, importedTypes });
}
