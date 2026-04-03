/**
 * Strava webhook event handler.
 *
 * Processes real-time activity events (create/update/delete) from Strava.
 * Uses shared utilities for token management and scoring rules.
 */
import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getStravaActivity } from "./client";
import { ensureFreshTokens } from "./token-manager";
import { mapStravaActivity } from "./mapper";
import { scoreActivity } from "@/lib/scoring/engine";
import { getActiveRulesForSeason } from "@/lib/scoring/active-rules";

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

  if (!user) return;

  const accessToken = await ensureFreshTokens(user);
  if (!accessToken) return;

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
    accessToken,
    String(event.object_id)
  );

  const mapped = mapStravaActivity(stravaActivity);
  if (!mapped) return; // unsupported activity type

  const activeRules = await getActiveRulesForSeason(mapped.season);

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
