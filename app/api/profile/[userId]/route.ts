import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activities, users, seasons } from "@/lib/db/schema";
import { sql, desc, eq } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: userIdStr } = await params;
  const userId = Number(userIdStr);
  if (isNaN(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const user = await db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const seasonParam = url.searchParams.get("season");
  const trendSeason = seasonParam ? Number(seasonParam) : new Date().getFullYear();

  const [
    allTimeTotals,
    bestActivity,
    bestSeason,
    bestMonth,
    activityBreakdown,
    monthlyTrends,
    allSeasonPoints,
    allSeasons,
    userActivityDates,
  ] = await Promise.all([
    // All-time totals
    db
      .select({
        totalPoints: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("totalPoints"),
        totalActivities: sql<number>`COUNT(${activities.id})`.as("totalActivities"),
        totalMiles: sql<number>`COALESCE(SUM(${activities.distanceMiles}), 0)`.as("totalMiles"),
        totalElevation: sql<number>`COALESCE(SUM(${activities.elevationGainFeet}), 0)`.as("totalElevation"),
        totalMinutes: sql<number>`COALESCE(SUM(${activities.durationMinutes}), 0)`.as("totalMinutes"),
        totalPoundsLifted: sql<number>`COALESCE(SUM(${activities.poundsLifted}), 0)`.as("totalPoundsLifted"),
      })
      .from(activities)
      .where(eq(activities.userId, userId))
      .get(),

    // Best single activity
    db
      .select({
        title: activities.title,
        type: activities.type,
        points: activities.modifiedPoints,
        date: activities.activityDate,
        season: activities.season,
      })
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.modifiedPoints))
      .limit(1)
      .get(),

    // Best season
    db
      .select({
        season: activities.season,
        points: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("points"),
      })
      .from(activities)
      .where(eq(activities.userId, userId))
      .groupBy(activities.season)
      .orderBy(desc(sql`points`))
      .limit(1)
      .get(),

    // Best month
    db
      .select({
        month: sql<string>`substr(${activities.activityDate}, 1, 7)`.as("month"),
        points: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("points"),
      })
      .from(activities)
      .where(eq(activities.userId, userId))
      .groupBy(sql`substr(${activities.activityDate}, 1, 7)`)
      .orderBy(desc(sql`points`))
      .limit(1)
      .get(),

    // Activity breakdown by type
    db
      .select({
        type: activities.type,
        count: sql<number>`COUNT(${activities.id})`.as("count"),
        points: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("points"),
      })
      .from(activities)
      .where(eq(activities.userId, userId))
      .groupBy(activities.type)
      .orderBy(desc(sql`points`)),

    // Monthly trends for the selected season
    db
      .select({
        month: sql<string>`substr(${activities.activityDate}, 1, 7)`.as("month"),
        points: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("points"),
        count: sql<number>`COUNT(${activities.id})`.as("count"),
      })
      .from(activities)
      .where(sql`${activities.userId} = ${userId} AND ${activities.season} = ${trendSeason}`)
      .groupBy(sql`substr(${activities.activityDate}, 1, 7)`)
      .orderBy(sql`month`),

    // All users' season points (for rank computation)
    db
      .select({
        userId: activities.userId,
        season: activities.season,
        points: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("points"),
        activityCount: sql<number>`COUNT(${activities.id})`.as("activityCount"),
        miles: sql<number>`COALESCE(SUM(${activities.distanceMiles}), 0)`.as("miles"),
        elevation: sql<number>`COALESCE(SUM(${activities.elevationGainFeet}), 0)`.as("elevation"),
      })
      .from(activities)
      .groupBy(activities.userId, activities.season),

    // All seasons
    db.select().from(seasons),

    // All activity dates for this user (for streaks/drought)
    db
      .select({
        date: activities.activityDate,
        season: activities.season,
      })
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(activities.activityDate),
  ]);

  // --- Compute streaks & drought from activity dates ---

  const dates = userActivityDates.map((r) => r.date);
  const uniqueDates = [...new Set(dates)].sort();

  // Longest drought (max gap between consecutive activities, within same season)
  let longestDrought: { days: number; from: string; to: string; season: number } | null = null;
  {
    let prevDate = "";
    let prevSeason = -1;
    for (const row of userActivityDates) {
      if (row.date === prevDate) continue; // skip duplicate dates
      if (prevDate && row.season === prevSeason) {
        const d1 = new Date(prevDate);
        const d2 = new Date(row.date);
        const gap = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        if (!longestDrought || gap > longestDrought.days) {
          longestDrought = { days: gap, from: prevDate, to: row.date, season: row.season };
        }
      }
      prevDate = row.date;
      prevSeason = row.season;
    }
  }

  // Weekly streak: group dates into ISO weeks, find longest consecutive run
  function getISOWeek(dateStr: string): string {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  }

  function weekToNumber(w: string): number {
    const [year, week] = w.split("-W").map(Number);
    return year * 53 + week;
  }

  const uniqueWeeks = [...new Set(uniqueDates.map(getISOWeek))].sort();

  let longestWeekStreak = { weeks: 0, from: "", to: "" };
  let currentWeekStreak = 0;
  {
    let runStart = 0;
    let bestLen = 0;
    let bestStart = 0;
    let bestEnd = 0;
    for (let i = 1; i < uniqueWeeks.length; i++) {
      if (weekToNumber(uniqueWeeks[i]) !== weekToNumber(uniqueWeeks[i - 1]) + 1) {
        const len = i - runStart;
        if (len > bestLen) {
          bestLen = len;
          bestStart = runStart;
          bestEnd = i - 1;
        }
        runStart = i;
      }
    }
    const len = uniqueWeeks.length - runStart;
    if (len > bestLen) {
      bestLen = len;
      bestStart = runStart;
      bestEnd = uniqueWeeks.length - 1;
    }
    if (bestLen > 0) {
      longestWeekStreak = { weeks: bestLen, from: uniqueWeeks[bestStart], to: uniqueWeeks[bestEnd] };
    }

    // Current week streak (from today backwards)
    const todayWeek = getISOWeek(new Date().toISOString().slice(0, 10));
    const todayWeekNum = weekToNumber(todayWeek);
    if (uniqueWeeks.length > 0) {
      const lastWeekNum = weekToNumber(uniqueWeeks[uniqueWeeks.length - 1]);
      if (lastWeekNum >= todayWeekNum - 1) {
        currentWeekStreak = 1;
        for (let i = uniqueWeeks.length - 2; i >= 0; i--) {
          if (weekToNumber(uniqueWeeks[i + 1]) === weekToNumber(uniqueWeeks[i]) + 1) {
            currentWeekStreak++;
          } else {
            break;
          }
        }
      }
    }
  }

  // Daily streak
  let longestDayStreak = { days: 0, from: "", to: "" };
  let currentDayStreak = 0;
  {
    let runStart = 0;
    let bestLen = 0;
    let bestStart = 0;
    let bestEnd = 0;
    for (let i = 1; i < uniqueDates.length; i++) {
      const d1 = new Date(uniqueDates[i - 1]);
      const d2 = new Date(uniqueDates[i]);
      const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000);
      if (diff !== 1) {
        const len = i - runStart;
        if (len > bestLen) {
          bestLen = len;
          bestStart = runStart;
          bestEnd = i - 1;
        }
        runStart = i;
      }
    }
    const len = uniqueDates.length - runStart;
    if (len > bestLen) {
      bestLen = len;
      bestStart = runStart;
      bestEnd = uniqueDates.length - 1;
    }
    if (bestLen > 0) {
      longestDayStreak = { days: bestLen, from: uniqueDates[bestStart], to: uniqueDates[bestEnd] };
    }

    // Current day streak
    const today = new Date().toISOString().slice(0, 10);
    if (uniqueDates.length > 0) {
      const last = uniqueDates[uniqueDates.length - 1];
      const daysSinceLast = Math.round((new Date(today).getTime() - new Date(last).getTime()) / 86400000);
      if (daysSinceLast <= 1) {
        currentDayStreak = 1;
        for (let i = uniqueDates.length - 2; i >= 0; i--) {
          const d1 = new Date(uniqueDates[i]);
          const d2 = new Date(uniqueDates[i + 1]);
          if (Math.round((d2.getTime() - d1.getTime()) / 86400000) === 1) {
            currentDayStreak++;
          } else {
            break;
          }
        }
      }
    }
  }

  // --- Season summaries with rank ---
  const seasonMap = new Map<number, typeof allSeasons[0]>();
  for (const s of allSeasons) {
    seasonMap.set(s.year, s);
  }

  // Group all users' points by season
  const pointsBySeason = new Map<number, { userId: number; points: number; activityCount: number; miles: number; elevation: number }[]>();
  for (const row of allSeasonPoints) {
    const arr = pointsBySeason.get(row.season) || [];
    arr.push(row);
    pointsBySeason.set(row.season, arr);
  }

  // Get seasons where this user has data
  const userSeasons = new Set(allSeasonPoints.filter((r) => r.userId === userId).map((r) => r.season));

  const seasonSummaries = [...userSeasons]
    .sort((a, b) => b - a)
    .map((yr) => {
      const seasonUsers = (pointsBySeason.get(yr) || []).sort((a, b) => b.points - a.points);
      const userEntry = seasonUsers.find((u) => u.userId === userId);
      const rank = seasonUsers.findIndex((u) => u.userId === userId) + 1;
      const seasonInfo = seasonMap.get(yr);
      return {
        season: yr,
        points: userEntry?.points ?? 0,
        activityCount: userEntry?.activityCount ?? 0,
        miles: userEntry?.miles ?? 0,
        elevation: userEntry?.elevation ?? 0,
        rank,
        isChampion: seasonInfo?.championUserId === userId || (rank === 1 && yr < new Date().getFullYear()),
      };
    });

  // Favorite activity (most points)
  const favoriteActivity = activityBreakdown.length > 0 ? activityBreakdown[0].type : null;

  // --- Cumulative points chart: one line per season ---
  // We need daily points per season for this user
  const dailyPointsForChart = await db
    .select({
      season: activities.season,
      activityDate: activities.activityDate,
      points: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("points"),
    })
    .from(activities)
    .where(eq(activities.userId, userId))
    .groupBy(activities.season, activities.activityDate)
    .orderBy(activities.activityDate);

  // Build lookup: season -> dateStr -> points
  const chartLookup = new Map<number, Map<string, number>>();
  for (const row of dailyPointsForChart) {
    if (!chartLookup.has(row.season)) chartLookup.set(row.season, new Map());
    chartLookup.get(row.season)!.set(row.activityDate, row.points);
  }

  const chartSeasons = [...userSeasons].sort();
  const currentYearNow = new Date().getFullYear();
  const todayNow = new Date();
  todayNow.setHours(0, 0, 0, 0);

  // Build day-by-day from Jan 1 to Dec 25 with cumulative per season
  const cumulativeChart: Record<string, string | number | null>[] = [];
  let decStartIndex = -1;

  const jan1 = new Date(2000, 0, 1); // template year doesn't matter, we use month/day
  const dec25 = new Date(2000, 11, 25);
  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const cumulative = new Map<number, number>();
  for (const s of chartSeasons) cumulative.set(s, 0);

  let dayIdx = 0;
  for (let d = new Date(2000, 0, 1); d <= dec25; d.setDate(d.getDate() + 1)) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const label = `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;

    if (d.getMonth() === 11 && decStartIndex === -1) {
      decStartIndex = dayIdx;
    }

    const row: Record<string, string | number | null> = { date: label };

    for (const s of chartSeasons) {
      const dateStr = `${s}-${mm}-${dd}`;
      const isFuture = s === currentYearNow && new Date(s, d.getMonth(), d.getDate()) > todayNow;
      if (isFuture) {
        row[String(s)] = null;
      } else {
        const dayPts = chartLookup.get(s)?.get(dateStr) ?? 0;
        const prev = cumulative.get(s)!;
        const cum = Math.round((prev + dayPts) * 100) / 100;
        cumulative.set(s, cum);
        row[String(s)] = cum;
      }
    }

    cumulativeChart.push(row);
    dayIdx++;
  }

  return NextResponse.json({
    user,
    allTime: allTimeTotals ?? {
      totalPoints: 0,
      totalActivities: 0,
      totalMiles: 0,
      totalElevation: 0,
      totalMinutes: 0,
      totalPoundsLifted: 0,
    },
    personalRecords: {
      bestActivity: bestActivity
        ? { title: bestActivity.title, type: bestActivity.type, points: bestActivity.points, date: bestActivity.date, season: bestActivity.season }
        : null,
      bestSeason: bestSeason ? { season: bestSeason.season, points: bestSeason.points } : null,
      bestMonth: bestMonth ? { month: bestMonth.month, points: bestMonth.points } : null,
      longestDrought,
      currentWeekStreak,
      longestWeekStreak: longestWeekStreak.weeks > 0 ? longestWeekStreak : null,
      currentDayStreak,
      longestDayStreak: longestDayStreak.days > 0 ? longestDayStreak : null,
    },
    activityBreakdown,
    favoriteActivity,
    monthlyTrends,
    seasonSummaries,
    cumulativeChart: {
      data: cumulativeChart,
      seasons: chartSeasons,
      decStartIndex,
    },
  });
}
