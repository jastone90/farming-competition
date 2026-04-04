import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activities, users } from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";

export async function GET() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prev.getFullYear();
  const month = String(prev.getMonth() + 1).padStart(2, "0");
  const firstDay = `${year}-${month}-01`;
  const lastDay = `${year}-${month}-31`;

  const rows = await db
    .select({
      userId: activities.userId,
      name: users.name,
      color: users.color,
      totalPoints: sql<number>`COALESCE(sum(${activities.modifiedPoints}), 0)`,
      activityCount: sql<number>`count(*)`,
    })
    .from(activities)
    .innerJoin(users, eq(activities.userId, users.id))
    .where(
      sql`${activities.activityDate} >= ${firstDay} AND ${activities.activityDate} <= ${lastDay}`
    )
    .groupBy(activities.userId)
    .orderBy(sql`sum(${activities.modifiedPoints}) desc`)
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    name: rows[0].name,
    color: rows[0].color,
    totalPoints: rows[0].totalPoints,
    activityCount: rows[0].activityCount,
    month: `${year}-${month}`,
  });
}
