import { db } from "@/lib/db";
import { activities, users, scoringRules } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getStravaActivity, refreshTokenIfNeeded } from "./client";
import { mapStravaActivity } from "./mapper";
import { scoreActivity } from "@/lib/scoring/engine";
import type { ActiveRule } from "@/lib/scoring/types";

export async function handleStravaEvent(event: {
  object_type: string;
  object_id: number;
  aspect_type: string;
  owner_id: number;
}) {
  if (event.object_type !== "activity") return;

  // Find user by strava athlete ID
  const user = await db
    .select()
    .from(users)
    .where(eq(users.stravaAthleteId, String(event.owner_id)))
    .get();

  if (!user || !user.stravaAccessToken || !user.stravaRefreshToken || !user.stravaTokenExpiresAt) {
    return;
  }

  const tokens = await refreshTokenIfNeeded(
    user.stravaAccessToken,
    user.stravaRefreshToken,
    user.stravaTokenExpiresAt
  );

  if (!tokens) return;

  // Update tokens if refreshed
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

  if (event.aspect_type === "delete") {
    await db
      .delete(activities)
      .where(
        and(
          eq(activities.stravaActivityId, String(event.object_id)),
          eq(activities.userId, user.id)
        )
      );
    return;
  }

  // Fetch activity from Strava
  const stravaActivity = await getStravaActivity(
    tokens.accessToken,
    String(event.object_id)
  );

  const mapped = mapStravaActivity(stravaActivity);
  if (!mapped) return; // unsupported activity type

  // Get scoring rules
  const rules = await db
    .select()
    .from(scoringRules)
    .where(
      sql`${scoringRules.isActive} = 1 AND ${scoringRules.effectiveSeason} <= ${mapped.season}`
    );

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

  if (event.aspect_type === "update") {
    const existing = await db
      .select()
      .from(activities)
      .where(eq(activities.stravaActivityId, String(event.object_id)))
      .get();

    if (existing) {
      await db
        .update(activities)
        .set({
          ...mapped,
          rawPoints: result.rawPoints,
          modifiedPoints: result.modifiedPoints,
          pointBreakdown: JSON.stringify(result.pointBreakdown),
        })
        .where(eq(activities.id, existing.id));
      return;
    }
  }

  // Check for duplicate
  const existing = await db
    .select()
    .from(activities)
    .where(eq(activities.stravaActivityId, mapped.stravaActivityId))
    .get();

  if (existing) return;

  await db.insert(activities).values({
    userId: user.id,
    source: "strava",
    ...mapped,
    rawPoints: result.rawPoints,
    modifiedPoints: result.modifiedPoints,
    pointBreakdown: JSON.stringify(result.pointBreakdown),
  });
}
