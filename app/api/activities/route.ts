import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { scoreActivity, getCurrentEngineVersion } from "@/lib/scoring/engine";
import { getActiveRulesForSeason } from "@/lib/scoring/active-rules";
import { getSeasonForDate } from "@/lib/utils/season";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const season = url.searchParams.get("season");
  const source = url.searchParams.get("source");
  const userId = url.searchParams.get("userId");
  const indoor = url.searchParams.get("indoor");
  const limit = parseInt(url.searchParams.get("limit") || "5000", 10);

  const conditions = [];
  if (season) conditions.push(eq(activities.season, parseInt(season)));
  if (source) conditions.push(eq(activities.source, source as "strava" | "manual"));
  if (userId) conditions.push(eq(activities.userId, parseInt(userId)));
  if (indoor === "true") conditions.push(eq(activities.isIndoor, true));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: activities.id,
      userId: activities.userId,
      source: activities.source,
      title: activities.title,
      type: activities.type,
      isIndoor: activities.isIndoor,
      distanceMiles: activities.distanceMiles,
      durationMinutes: activities.durationMinutes,
      elevationGainFeet: activities.elevationGainFeet,
      caloriesBurned: activities.caloriesBurned,
      poundsLifted: activities.poundsLifted,
      rawPoints: activities.rawPoints,
      modifiedPoints: activities.modifiedPoints,
      pointBreakdown: activities.pointBreakdown,
      activityDate: activities.activityDate,
      season: activities.season,
      createdAt: activities.createdAt,
      userName: users.name,
      userColor: users.color,
    })
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id))
    .where(where)
    .orderBy(desc(activities.activityDate), desc(activities.createdAt))
    .limit(limit);

  const parsed = rows.map((r) => ({
    ...r,
    pointBreakdown: JSON.parse(r.pointBreakdown),
  }));

  return NextResponse.json(parsed);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { type, title, isIndoor, distanceMiles, durationMinutes, elevationGainFeet, caloriesBurned, poundsLifted, activityDate } = body;

  if (!type || !activityDate) {
    return NextResponse.json({ error: "Type and date are required" }, { status: 400 });
  }

  // Season = calendar year of the activity date
  const season = getSeasonForDate(activityDate);

  const activeRules = await getActiveRulesForSeason(season);

  const result = scoreActivity(
    { type, isIndoor: isIndoor || false, activityDate, distanceMiles, durationMinutes, elevationGainFeet, caloriesBurned, poundsLifted },
    activeRules
  );

  const engineVersion = await getCurrentEngineVersion();

  const [inserted] = await db
    .insert(activities)
    .values({
      userId: session.id,
      source: "manual",
      title: title || type,
      type,
      isIndoor: isIndoor || false,
      distanceMiles,
      durationMinutes,
      elevationGainFeet,
      caloriesBurned,
      poundsLifted,
      rawPoints: result.rawPoints,
      modifiedPoints: result.modifiedPoints,
      pointBreakdown: JSON.stringify(result.pointBreakdown),
      activityDate,
      season,
      engineVersion,
    })
    .returning();

  return NextResponse.json({ ...inserted, pointBreakdown: result.pointBreakdown });
}
