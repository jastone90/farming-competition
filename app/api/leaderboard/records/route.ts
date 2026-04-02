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
  ]);

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
    return row ? buildRecord(row, row.value, { title: row.title, date: row.date }) : null;
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
  });
}
