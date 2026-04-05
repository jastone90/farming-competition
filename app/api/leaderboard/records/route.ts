/**
 * All-time records API.
 *
 * Returns the best single-activity and season-aggregate records across all users.
 * Uses two query helpers to avoid repeating the same SELECT/ORDER/LIMIT pattern:
 *  - topActivity(): best single activity by a given column, optionally filtered
 *  - topSeasonAggregate(): best user+season group by an aggregate expression
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { sql, desc, eq, asc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export async function GET() {
  const allUsers = await db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(users);

  const findUser = (userId: number) => allUsers.find((u) => u.id === userId);

  // --- Query helpers ---

  /** Best single activity by a column, with optional WHERE filter */
  async function topActivity(
    valueCol: any,
    where?: SQL
  ) {
    let query = db
      .select({
        id: activities.id,
        userId: activities.userId,
        title: activities.title,
        value: valueCol,
        date: activities.activityDate,
        season: activities.season,
      })
      .from(activities);
    if (where) query = query.where(where) as typeof query;
    return query.orderBy(desc(valueCol)).limit(1).get();
  }

  /** Best user+season group by an aggregate, with optional WHERE and sort direction */
  async function topSeasonAggregate(
    aggExpr: SQL<number>,
    options?: { where?: SQL; direction?: "desc" | "asc" }
  ) {
    const { where, direction = "desc" } = options ?? {};
    let query = db
      .select({
        userId: activities.userId,
        season: activities.season,
        total: aggExpr.as("total"),
      })
      .from(activities);
    if (where) query = query.where(where) as typeof query;
    return query
      .groupBy(activities.userId, activities.season)
      .orderBy(direction === "desc" ? desc(sql`total`) : asc(sql`total`))
      .limit(1)
      .get();
  }

  /** Best season group by an aggregate across ALL users (no userId grouping) */
  async function topGroupSeasonAggregate(aggExpr: SQL<number>) {
    return db
      .select({
        season: activities.season,
        total: aggExpr.as("total"),
      })
      .from(activities)
      .groupBy(activities.season)
      .orderBy(desc(sql`total`))
      .limit(1)
      .get();
  }

  // --- Queries ---

  const [
    highestScoring,
    longestRide,
    longestRun,
    mountainGoat,
    heaviestHaybailz,
    mostPointsSeason,
    mostActivitiesSeason,
    mostMilesSeason,
    mostElevationSeason,
    biggestDecember,
    leastPointsSeason,
    highestIndividualMonth,
    highestMonth,
    mostCombinedPointsSeason,
    mostCombinedMilesSeason,
    mostCombinedElevationSeason,
    mostCombinedActivitiesSeason,
    highestDay,
    lowestMonth,
  ] = await Promise.all([
    // Single activity records
    topActivity(activities.modifiedPoints),
    topActivity(activities.distanceMiles, eq(activities.type, "ride")),
    topActivity(activities.distanceMiles, eq(activities.type, "run")),
    topActivity(activities.elevationGainFeet),
    topActivity(activities.poundsLifted, sql`${activities.poundsLifted} > 0`),

    // Season aggregates
    topSeasonAggregate(sql<number>`SUM(${activities.modifiedPoints})`),
    topSeasonAggregate(sql<number>`COUNT(${activities.id})`),
    topSeasonAggregate(sql<number>`COALESCE(SUM(${activities.distanceMiles}), 0)`),
    topSeasonAggregate(sql<number>`COALESCE(SUM(${activities.elevationGainFeet}), 0)`),

    // Dubious honors
    topSeasonAggregate(
      sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`,
      { where: sql`substr(${activities.activityDate}, 6, 2) = '12'` }
    ),
    topSeasonAggregate(
      sql<number>`SUM(${activities.modifiedPoints})`,
      { where: sql`${activities.season} < ${new Date().getFullYear()}`, direction: "asc" }
    ),

    // Monthly records
    db.select({
      userId: activities.userId,
      season: activities.season,
      month: sql<string>`substr(${activities.activityDate}, 1, 7)`.as("month"),
      total: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("total"),
    })
      .from(activities)
      .groupBy(activities.userId, sql`substr(${activities.activityDate}, 1, 7)`)
      .orderBy(desc(sql`total`))
      .limit(1)
      .get(),

    db.select({
      season: activities.season,
      month: sql<string>`substr(${activities.activityDate}, 1, 7)`.as("month"),
      total: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("total"),
    })
      .from(activities)
      .groupBy(sql`substr(${activities.activityDate}, 1, 7)`)
      .orderBy(desc(sql`total`))
      .limit(1)
      .get(),

    // Group records (all competitors combined per season)
    topGroupSeasonAggregate(sql<number>`SUM(${activities.modifiedPoints})`),
    topGroupSeasonAggregate(sql<number>`COALESCE(SUM(${activities.distanceMiles}), 0)`),
    topGroupSeasonAggregate(sql<number>`COALESCE(SUM(${activities.elevationGainFeet}), 0)`),
    topGroupSeasonAggregate(sql<number>`COUNT(${activities.id})`),

    // Highest output day (all competitors combined)
    db.select({
      date: activities.activityDate,
      total: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("total"),
    })
      .from(activities)
      .groupBy(activities.activityDate)
      .orderBy(desc(sql`total`))
      .limit(1)
      .get(),

    // Lowest output month (all competitors combined, exclude current month)
    (() => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return db.select({
        season: activities.season,
        month: sql<string>`substr(${activities.activityDate}, 1, 7)`.as("month"),
        total: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("total"),
      })
        .from(activities)
        .where(sql`substr(${activities.activityDate}, 1, 7) < ${currentMonth}`)
        .groupBy(sql`substr(${activities.activityDate}, 1, 7)`)
        .orderBy(asc(sql`total`))
        .limit(1)
        .get();
    })(),
  ]);

  // --- Longest drought: max gap between activities per user (within a season) ---
  const droughtRows = await db
    .select({
      userId: activities.userId,
      season: activities.season,
      date: activities.activityDate,
    })
    .from(activities)
    .orderBy(activities.userId, activities.season, activities.activityDate);

  let longestDrought: { userId: number; season: number; days: number; from: string; to: string } | null = null;

  {
    let prevUserId = -1;
    let prevSeason = -1;
    let prevDate = "";
    for (const row of droughtRows) {
      if (row.userId === prevUserId && row.season === prevSeason && row.date !== prevDate) {
        const d1 = new Date(prevDate);
        const d2 = new Date(row.date);
        const gap = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        if (!longestDrought || gap > longestDrought.days) {
          longestDrought = { userId: row.userId, season: row.season, days: gap, from: prevDate, to: row.date };
        }
      }
      prevUserId = row.userId;
      prevSeason = row.season;
      prevDate = row.date;
    }
  }

  // --- Active drought: days since each user's last activity in the current season ---
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
  const lastActivityRows = await db
    .select({
      userId: activities.userId,
      lastDate: sql<string>`MAX(${activities.activityDate})`.as("lastDate"),
    })
    .from(activities)
    .where(eq(activities.season, currentYear))
    .groupBy(activities.userId);

  let activeDrought: { userId: number; days: number; since: string } | null = null;
  for (const row of lastActivityRows) {
    const gap = Math.round((new Date(today).getTime() - new Date(row.lastDate).getTime()) / (1000 * 60 * 60 * 24));
    if (!activeDrought || gap > activeDrought.days) {
      activeDrought = { userId: row.userId, days: gap, since: row.lastDate };
    }
  }

  // --- Response formatting ---

  function buildRecord(
    row: { userId: number; season: number } | null | undefined,
    value: number | string | null | undefined,
    extra?: Record<string, unknown>
  ) {
    if (!row) return null;
    const user = findUser(row.userId);
    return {
      holder: user?.name ?? "Unknown",
      color: user?.color ?? "#888",
      value,
      season: row.season,
      ...extra,
    };
  }

  function activityRecord(row: typeof highestScoring) {
    return row ? buildRecord(row, row.value, { activityId: row.id, title: row.title, date: row.date }) : null;
  }

  function seasonRecord(row: typeof mostPointsSeason) {
    return row ? buildRecord(row, row.total) : null;
  }

  return NextResponse.json({
    highestScoring: activityRecord(highestScoring),
    longestRide: activityRecord(longestRide),
    longestRun: activityRecord(longestRun),
    mountainGoat: activityRecord(mountainGoat),
    heaviestHaybailz: activityRecord(heaviestHaybailz),

    mostPointsSeason: seasonRecord(mostPointsSeason),
    mostActivitiesSeason: seasonRecord(mostActivitiesSeason),
    mostMilesSeason: seasonRecord(mostMilesSeason),
    mostElevationSeason: seasonRecord(mostElevationSeason),

    biggestDecember: seasonRecord(biggestDecember),
    leastPointsSeason: seasonRecord(leastPointsSeason),

    highestIndividualMonth: highestIndividualMonth
      ? { ...buildRecord(highestIndividualMonth, highestIndividualMonth.total), month: highestIndividualMonth.month }
      : null,
    highestMonth: highestMonth
      ? { month: highestMonth.month, total: highestMonth.total }
      : null,

    mostCombinedPointsSeason: mostCombinedPointsSeason
      ? { season: mostCombinedPointsSeason.season, total: mostCombinedPointsSeason.total }
      : null,
    mostCombinedMilesSeason: mostCombinedMilesSeason
      ? { season: mostCombinedMilesSeason.season, total: mostCombinedMilesSeason.total }
      : null,
    mostCombinedElevationSeason: mostCombinedElevationSeason
      ? { season: mostCombinedElevationSeason.season, total: mostCombinedElevationSeason.total }
      : null,
    mostCombinedActivitiesSeason: mostCombinedActivitiesSeason
      ? { season: mostCombinedActivitiesSeason.season, total: mostCombinedActivitiesSeason.total }
      : null,
    highestDay: highestDay
      ? { date: highestDay.date, total: highestDay.total }
      : null,
    lowestMonth: lowestMonth
      ? { month: lowestMonth.month, total: lowestMonth.total }
      : null,
    longestDrought: longestDrought
      ? {
          holder: findUser(longestDrought.userId)?.name ?? "Unknown",
          color: findUser(longestDrought.userId)?.color ?? "#888",
          season: longestDrought.season,
          days: longestDrought.days,
          from: longestDrought.from,
          to: longestDrought.to,
        }
      : null,
    activeDrought: activeDrought
      ? {
          holder: findUser(activeDrought.userId)?.name ?? "Unknown",
          color: findUser(activeDrought.userId)?.color ?? "#888",
          days: activeDrought.days,
          since: activeDrought.since,
        }
      : null,
  });
}
