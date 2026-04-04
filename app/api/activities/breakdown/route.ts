import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select({
      type: activities.type,
      isIndoor: activities.isIndoor,
      count: sql<number>`count(*)`,
      totalPoints: sql<number>`sum(${activities.modifiedPoints})`,
      totalMiles: sql<number>`sum(${activities.distanceMiles})`,
      totalElevation: sql<number>`sum(${activities.elevationGainFeet})`,
      totalDuration: sql<number>`sum(${activities.durationMinutes})`,
      totalPoundsLifted: sql<number>`sum(${activities.poundsLifted})`,
    })
    .from(activities)
    .groupBy(activities.type, activities.isIndoor)
    .orderBy(sql`sum(${activities.modifiedPoints}) desc`);

  return NextResponse.json(rows);
}
