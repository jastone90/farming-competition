import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activities, users, seasons } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";

export async function GET() {
  // Get all seasons
  const allSeasons = await db.select().from(seasons).orderBy(seasons.year);

  // Get all users
  const allUsers = await db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(users);

  // Get points per user per season
  const pointsBySeason = await db
    .select({
      userId: activities.userId,
      season: activities.season,
      totalPoints: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("total_points"),
    })
    .from(activities)
    .groupBy(activities.userId, activities.season)
    .orderBy(activities.season);

  // Build chart data
  const chartData = allSeasons.map((s) => {
    const row: Record<string, string | number> = { season: `'${String(s.year).slice(2)}` };
    allUsers.forEach((user) => {
      const pts = pointsBySeason.find(
        (p) => p.userId === user.id && p.season === s.year
      );
      row[user.name] = pts ? Math.round(pts.totalPoints * 10) / 10 : 0;
    });
    return row;
  });

  // Get champions per season
  const champions = allSeasons.map((s) => {
    const seasonPoints = pointsBySeason.filter((p) => p.season === s.year);
    if (seasonPoints.length === 0) return { year: s.year, champion: null };
    const best = seasonPoints.reduce((a, b) =>
      a.totalPoints > b.totalPoints ? a : b
    );
    const user = allUsers.find((u) => u.id === best.userId);
    return {
      year: s.year,
      champion: user
        ? { name: user.name, color: user.color, points: best.totalPoints }
        : null,
    };
  });

  // Get December points per user per season (Hall of Shame)
  const decemberPoints = await db
    .select({
      userId: activities.userId,
      season: activities.season,
      decPoints: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("dec_points"),
    })
    .from(activities)
    .where(sql`substr(${activities.activityDate}, 6, 2) = '12'`)
    .groupBy(activities.userId, activities.season)
    .orderBy(activities.season);

  // Find the biggest December scorer per season
  const shameList = allSeasons.map((s) => {
    const seasonDec = decemberPoints.filter((p) => p.season === s.year);
    if (seasonDec.length === 0) return { year: s.year, shamer: null };
    const worst = seasonDec.reduce((a, b) =>
      a.decPoints > b.decPoints ? a : b
    );
    if (worst.decPoints <= 0) return { year: s.year, shamer: null };
    const user = allUsers.find((u) => u.id === worst.userId);
    return {
      year: s.year,
      shamer: user
        ? { name: user.name, color: user.color, points: worst.decPoints }
        : null,
    };
  });

  // All-time records
  const bestSeason = await db
    .select({
      userId: activities.userId,
      season: activities.season,
      totalPoints: sql<number>`SUM(${activities.modifiedPoints})`.as("total_points"),
    })
    .from(activities)
    .groupBy(activities.userId, activities.season)
    .orderBy(desc(sql`total_points`))
    .limit(1)
    .get();

  const bestSeasonUser = bestSeason
    ? allUsers.find((u) => u.id === bestSeason.userId)
    : null;

  return NextResponse.json({
    chartData,
    users: allUsers,
    champions,
    shameList,
    records: {
      bestSeason: bestSeason
        ? {
            holder: bestSeasonUser?.name,
            color: bestSeasonUser?.color,
            points: bestSeason.totalPoints,
            season: bestSeason.season,
          }
        : null,
    },
  });
}
