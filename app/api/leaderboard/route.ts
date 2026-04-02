import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const season = parseInt(url.searchParams.get("season") || String(new Date().getFullYear()));

  // Get total points per user for the season
  const standings = await db
    .select({
      userId: activities.userId,
      totalPoints: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("total_points"),
      activityCount: sql<number>`COUNT(${activities.id})`.as("activity_count"),
    })
    .from(activities)
    .where(eq(activities.season, season))
    .groupBy(activities.userId)
    .orderBy(desc(sql`total_points`));

  // Get all users
  const allUsers = await db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(users);

  // Get weekly activity count (current week)
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const weeklyStats = await db
    .select({
      userId: activities.userId,
      count: sql<number>`COUNT(${activities.id})`.as("count"),
      weekPoints: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("week_points"),
    })
    .from(activities)
    .where(sql`${activities.activityDate} >= ${weekStartStr} AND ${activities.season} = ${season}`)
    .groupBy(activities.userId);

  // Merge data
  const leaderboard = allUsers.map((user) => {
    const standing = standings.find((s) => s.userId === user.id);
    const weekly = weeklyStats.find((w) => w.userId === user.id);
    return {
      userId: user.id,
      name: user.name,
      color: user.color,
      totalPoints: standing?.totalPoints ?? 0,
      activityCount: standing?.activityCount ?? 0,
      weeklyActivities: weekly?.count ?? 0,
      weeklyPoints: weekly?.weekPoints ?? 0,
    };
  });

  leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

  return NextResponse.json({ season, leaderboard });
}
