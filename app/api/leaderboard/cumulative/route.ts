import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const season = parseInt(
    url.searchParams.get("season") || String(new Date().getFullYear())
  );

  const allUsers = await db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(users);

  // Group activities by (userId, date) for the season
  const dailyPoints = await db
    .select({
      userId: activities.userId,
      activityDate: activities.activityDate,
      points: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as(
        "points"
      ),
    })
    .from(activities)
    .where(eq(activities.season, season))
    .groupBy(activities.userId, activities.activityDate)
    .orderBy(activities.activityDate);

  // Build a lookup: userId -> dateStr -> points
  const lookup = new Map<number, Map<string, number>>();
  for (const row of dailyPoints) {
    if (!lookup.has(row.userId)) lookup.set(row.userId, new Map());
    lookup.get(row.userId)!.set(row.activityDate, row.points);
  }

  // Build every day from Jan 1 to Dec 25
  const jan1 = new Date(season, 0, 1);
  const dec25 = new Date(season, 11, 25);
  const currentYear = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const data: Record<string, string | number | null>[] = [];
  const cumulative = new Map<number, number>();
  for (const u of allUsers) cumulative.set(u.id, 0);

  let decStartIndex = -1;
  let dayIndex = 0;

  for (let d = new Date(jan1); d <= dec25; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const label = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;

    // Track where December starts
    if (d.getMonth() === 11 && decStartIndex === -1) {
      decStartIndex = dayIndex;
    }

    const isFuture = season === currentYear && d > today;

    const row: Record<string, string | number | null> = { date: label };

    if (isFuture) {
      for (const u of allUsers) {
        row[u.name] = null;
      }
    } else {
      for (const u of allUsers) {
        const dayPts = lookup.get(u.id)?.get(dateStr) ?? 0;
        const prev = cumulative.get(u.id)!;
        const cum = Math.round((prev + dayPts) * 100) / 100;
        cumulative.set(u.id, cum);
        row[u.name] = cum;
      }
    }

    data.push(row);
    dayIndex++;
  }

  return NextResponse.json({
    season,
    data,
    totalDays: data.length,
    decStartIndex,
    users: allUsers.map((u) => ({ name: u.name, color: u.color })),
  });
}
