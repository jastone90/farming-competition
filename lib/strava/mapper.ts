/**
 * Maps Strava API activity objects to the internal format.
 *
 * Only competition-eligible types are mapped (run, ride, swim, weight training).
 * All other Strava types (walk, hike, yoga, CrossFit, etc.) return null and
 * are skipped during import. Unit conversions: meters→miles, meters→feet.
 *
 * @see lib/scoring/types.ts — ActivityType enum
 * @see lib/utils/season.ts — shared season calculation
 */
import type { ActivityType } from "@/lib/scoring/types";
import { getSeasonForDate } from "@/lib/utils/season";

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  trainer?: boolean;
  distance: number; // meters
  moving_time: number; // seconds
  total_elevation_gain: number; // meters
  calories?: number;
  start_date: string;
}

export function mapStravaActivity(strava: StravaActivity) {
  const typeMap: Record<string, { type: ActivityType; indoor?: boolean }> = {
    Ride: { type: "ride" },
    VirtualRide: { type: "ride", indoor: true },
    Run: { type: "run" },
    VirtualRun: { type: "run", indoor: true },
    Swim: { type: "swimming" },
    WeightTraining: { type: "weight_training" },
  };

  const mapped = typeMap[strava.type];
  if (!mapped) return null;

  const isIndoor = mapped.indoor || strava.trainer || false;

  const distanceMiles = strava.distance > 0 ? strava.distance / 1609.34 : null;
  const elevationGainFeet =
    strava.total_elevation_gain > 0
      ? strava.total_elevation_gain * 3.28084
      : null;
  const durationMinutes = strava.moving_time / 60;
  const caloriesBurned = strava.calories || null;

  const actDate = new Date(strava.start_date);
  const season = getSeasonForDate(actDate);

  return {
    stravaActivityId: String(strava.id),
    title: strava.name,
    type: mapped.type,
    isIndoor,
    distanceMiles: distanceMiles ? Math.round(distanceMiles * 100) / 100 : null,
    durationMinutes: Math.round(durationMinutes * 10) / 10,
    elevationGainFeet: elevationGainFeet
      ? Math.round(elevationGainFeet * 10) / 10
      : null,
    caloriesBurned,
    activityDate: actDate.toISOString().split("T")[0],
    season,
  };
}
