/**
 * Builds the "Suggested activities" list for the manual entry dialog.
 *
 * Groups a user's activities by their metrics (type, isIndoor, withChild,
 * distanceMiles, elevationGainFeet, poundsLifted) and returns the top buckets
 * ordered by count. Title is not part of the dedup key — each bucket's title
 * is resolved to the most-recently-logged matching activity.
 *
 * Scope is the current season; if the current season has no activities for
 * the user, falls back to all-time.
 */
import { db as defaultDb } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { sql, and, eq } from "drizzle-orm";
import type { ActivityType } from "@/lib/scoring/types";

export type Suggestion = {
  type: ActivityType;
  title: string;
  isIndoor: boolean;
  withChild: boolean;
  distanceMiles: number | null;
  elevationGainFeet: number | null;
  poundsLifted: number | null;
  count: number;
};

export async function buildSuggestions(
  userId: number,
  currentSeason: number,
  db = defaultDb,
): Promise<Suggestion[]> {
  async function groupBuckets(seasonFilter: number | null) {
    const where =
      seasonFilter != null
        ? and(
            eq(activities.userId, userId),
            eq(activities.season, seasonFilter),
          )
        : eq(activities.userId, userId);

    return db
      .select({
        type: activities.type,
        isIndoor: activities.isIndoor,
        withChild: activities.withChild,
        distanceMiles: activities.distanceMiles,
        elevationGainFeet: activities.elevationGainFeet,
        poundsLifted: activities.poundsLifted,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(activities)
      .where(where)
      .groupBy(
        activities.type,
        activities.isIndoor,
        activities.withChild,
        activities.distanceMiles,
        activities.elevationGainFeet,
        activities.poundsLifted,
      )
      .orderBy(sql`count(*) desc`)
      .limit(10);
  }

  let buckets = await groupBuckets(currentSeason);
  if (buckets.length === 0) {
    buckets = await groupBuckets(null);
  }

  // Resolve the title for each bucket from its most-recently-created row.
  // SQLite's `IS` operator is null-safe equality, so null-valued metric fields
  // match null in the lookup correctly.
  const results: Suggestion[] = [];
  for (const b of buckets) {
    const titleRows = await db
      .select({ title: activities.title })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          eq(activities.type, b.type),
          eq(activities.isIndoor, b.isIndoor),
          eq(activities.withChild, b.withChild),
          sql`${activities.distanceMiles} IS ${b.distanceMiles}`,
          sql`${activities.elevationGainFeet} IS ${b.elevationGainFeet}`,
          sql`${activities.poundsLifted} IS ${b.poundsLifted}`,
        ),
      )
      .orderBy(sql`${activities.createdAt} desc`)
      .limit(1);

    results.push({
      type: b.type as ActivityType,
      title: titleRows[0]?.title ?? b.type,
      isIndoor: b.isIndoor,
      withChild: b.withChild,
      distanceMiles: b.distanceMiles,
      elevationGainFeet: b.elevationGainFeet,
      poundsLifted: b.poundsLifted,
      count: Number(b.count),
    });
  }
  return results;
}
