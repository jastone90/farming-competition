import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { sql, desc, eq, asc } from "drizzle-orm";

export async function GET() {
  const allUsers = await db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(users);

  function findUser(userId: number) {
    return allUsers.find((u) => u.id === userId);
  }

  // --- Single Activity Records ---

  // Highest scoring activity
  const highestScoring = await db
    .select({
      userId: activities.userId,
      title: activities.title,
      points: activities.modifiedPoints,
      date: activities.activityDate,
      season: activities.season,
    })
    .from(activities)
    .orderBy(desc(activities.modifiedPoints))
    .limit(1)
    .get();

  // Longest ride (by distance)
  const longestRide = await db
    .select({
      userId: activities.userId,
      title: activities.title,
      distance: activities.distanceMiles,
      date: activities.activityDate,
      season: activities.season,
    })
    .from(activities)
    .where(eq(activities.type, "ride"))
    .orderBy(desc(activities.distanceMiles))
    .limit(1)
    .get();

  // Longest run (by distance)
  const longestRun = await db
    .select({
      userId: activities.userId,
      title: activities.title,
      distance: activities.distanceMiles,
      date: activities.activityDate,
      season: activities.season,
    })
    .from(activities)
    .where(eq(activities.type, "run"))
    .orderBy(desc(activities.distanceMiles))
    .limit(1)
    .get();

  // Mountain goat (most elevation in single activity)
  const mountainGoat = await db
    .select({
      userId: activities.userId,
      title: activities.title,
      elevation: activities.elevationGainFeet,
      date: activities.activityDate,
      season: activities.season,
    })
    .from(activities)
    .orderBy(desc(activities.elevationGainFeet))
    .limit(1)
    .get();

  // Heaviest haybailz (most pounds lifted)
  const heaviestHaybailz = await db
    .select({
      userId: activities.userId,
      title: activities.title,
      pounds: activities.poundsLifted,
      date: activities.activityDate,
      season: activities.season,
    })
    .from(activities)
    .where(sql`${activities.poundsLifted} > 0`)
    .orderBy(desc(activities.poundsLifted))
    .limit(1)
    .get();

  // --- Season Records ---

  // Most points in a season
  const mostPointsSeason = await db
    .select({
      userId: activities.userId,
      season: activities.season,
      total: sql<number>`SUM(${activities.modifiedPoints})`.as("total"),
    })
    .from(activities)
    .groupBy(activities.userId, activities.season)
    .orderBy(desc(sql`total`))
    .limit(1)
    .get();

  // Most activities in a season
  const mostActivitiesSeason = await db
    .select({
      userId: activities.userId,
      season: activities.season,
      total: sql<number>`COUNT(${activities.id})`.as("total"),
    })
    .from(activities)
    .groupBy(activities.userId, activities.season)
    .orderBy(desc(sql`total`))
    .limit(1)
    .get();

  // Most miles in a season
  const mostMilesSeason = await db
    .select({
      userId: activities.userId,
      season: activities.season,
      total: sql<number>`COALESCE(SUM(${activities.distanceMiles}), 0)`.as("total"),
    })
    .from(activities)
    .groupBy(activities.userId, activities.season)
    .orderBy(desc(sql`total`))
    .limit(1)
    .get();

  // Most elevation in a season
  const mostElevationSeason = await db
    .select({
      userId: activities.userId,
      season: activities.season,
      total: sql<number>`COALESCE(SUM(${activities.elevationGainFeet}), 0)`.as("total"),
    })
    .from(activities)
    .groupBy(activities.userId, activities.season)
    .orderBy(desc(sql`total`))
    .limit(1)
    .get();

  // --- Dubious Honors ---

  // Biggest December offender (single season)
  const biggestDecember = await db
    .select({
      userId: activities.userId,
      season: activities.season,
      total: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("total"),
    })
    .from(activities)
    .where(sql`substr(${activities.activityDate}, 6, 2) = '12'`)
    .groupBy(activities.userId, activities.season)
    .orderBy(desc(sql`total`))
    .limit(1)
    .get();

  // Least points in a season (completed seasons only — exclude current year)
  const currentYear = new Date().getFullYear();
  const leastPointsSeason = await db
    .select({
      userId: activities.userId,
      season: activities.season,
      total: sql<number>`SUM(${activities.modifiedPoints})`.as("total"),
    })
    .from(activities)
    .where(sql`${activities.season} < ${currentYear}`)
    .groupBy(activities.userId, activities.season)
    .orderBy(asc(sql`total`))
    .limit(1)
    .get();

  // --- Highest Scoring Month (single competitor) ---
  const highestIndividualMonth = await db
    .select({
      userId: activities.userId,
      season: activities.season,
      month: sql<string>`substr(${activities.activityDate}, 1, 7)`.as("month"),
      total: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("total"),
    })
    .from(activities)
    .groupBy(activities.userId, sql`substr(${activities.activityDate}, 1, 7)`)
    .orderBy(desc(sql`total`))
    .limit(1)
    .get();

  // --- Highest Output Month (all competitors combined) ---
  const highestMonth = await db
    .select({
      season: activities.season,
      month: sql<string>`substr(${activities.activityDate}, 1, 7)`.as("month"),
      total: sql<number>`COALESCE(SUM(${activities.modifiedPoints}), 0)`.as("total"),
    })
    .from(activities)
    .groupBy(sql`substr(${activities.activityDate}, 1, 7)`)
    .orderBy(desc(sql`total`))
    .limit(1)
    .get();

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

  return NextResponse.json({
    // Single activity records
    highestScoring: highestScoring
      ? buildRecord(highestScoring, highestScoring.points, { title: highestScoring.title, date: highestScoring.date })
      : null,
    longestRide: longestRide
      ? buildRecord(longestRide, longestRide.distance, { title: longestRide.title, date: longestRide.date })
      : null,
    longestRun: longestRun
      ? buildRecord(longestRun, longestRun.distance, { title: longestRun.title, date: longestRun.date })
      : null,
    mountainGoat: mountainGoat
      ? buildRecord(mountainGoat, mountainGoat.elevation, { title: mountainGoat.title, date: mountainGoat.date })
      : null,
    heaviestHaybailz: heaviestHaybailz
      ? buildRecord(heaviestHaybailz, heaviestHaybailz.pounds, { title: heaviestHaybailz.title, date: heaviestHaybailz.date })
      : null,

    // Season records
    mostPointsSeason: mostPointsSeason
      ? buildRecord(mostPointsSeason, mostPointsSeason.total)
      : null,
    mostActivitiesSeason: mostActivitiesSeason
      ? buildRecord(mostActivitiesSeason, mostActivitiesSeason.total)
      : null,
    mostMilesSeason: mostMilesSeason
      ? buildRecord(mostMilesSeason, mostMilesSeason.total)
      : null,
    mostElevationSeason: mostElevationSeason
      ? buildRecord(mostElevationSeason, mostElevationSeason.total)
      : null,

    // Dubious honors
    biggestDecember: biggestDecember
      ? buildRecord(biggestDecember, biggestDecember.total)
      : null,
    leastPointsSeason: leastPointsSeason
      ? buildRecord(leastPointsSeason, leastPointsSeason.total)
      : null,

    // Combined
    highestIndividualMonth: highestIndividualMonth
      ? {
          ...buildRecord(highestIndividualMonth, highestIndividualMonth.total),
          month: highestIndividualMonth.month,
        }
      : null,
    highestMonth: highestMonth
      ? {
          month: highestMonth.month,
          total: highestMonth.total,
        }
      : null,
  });
}
