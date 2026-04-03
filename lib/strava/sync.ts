import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStravaActivities } from "@/lib/strava/client";
import { ensureFreshTokens } from "@/lib/strava/token-manager";
import { mapStravaActivity } from "@/lib/strava/mapper";
import { scoreActivity, getCurrentEngineVersion } from "@/lib/scoring/engine";
import { getActiveRulesForSeason } from "@/lib/scoring/active-rules";

interface User {
  id: number;
  name: string;
  stravaAthleteId: string | null;
  stravaAccessToken: string | null;
  stravaRefreshToken: string | null;
  stravaTokenExpiresAt: number | null;
  [key: string]: unknown;
}

export interface SyncResult {
  imported: number;
  skipped: number;
  skippedTypes: Record<string, number>;
  importedTypes: Record<string, number>;
  totalPoints: number;
}

export async function syncUserActivities(
  user: User,
  options?: { after?: number }
): Promise<SyncResult> {
  const accessToken = await ensureFreshTokens(user);
  if (!accessToken) {
    throw new Error("Strava not connected or token refresh failed");
  }

  const engineVersion = await getCurrentEngineVersion();
  const rulesCache = new Map();

  const now = new Date();
  const after =
    options?.after ??
    Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000);

  let imported = 0;
  let skipped = 0;
  let totalPoints = 0;
  const skippedTypes: Record<string, number> = {};
  const importedTypes: Record<string, number> = {};
  let page = 1;

  while (true) {
    const stravaActivities = await getStravaActivities(
      accessToken,
      page,
      30,
      after
    );
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

      if (!rulesCache.has(mapped.season)) {
        rulesCache.set(
          mapped.season,
          await getActiveRulesForSeason(mapped.season)
        );
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
      totalPoints += result.modifiedPoints;
      imported++;
    }

    page++;
  }

  return { imported, skipped, skippedTypes, importedTypes, totalPoints };
}
