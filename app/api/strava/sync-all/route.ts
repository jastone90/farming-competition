import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";
import { syncUserActivities } from "@/lib/strava/sync";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.STRAVA_SYNC_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connectedUsers = await db
    .select()
    .from(users)
    .where(isNotNull(users.stravaAthleteId))
    .all();

  const now = new Date();
  const after = Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000);

  const results = [];

  for (const user of connectedUsers) {
    try {
      const result = await syncUserActivities(user, { after });

      if (result.imported > 0) {
        await logAudit({
          userId: user.id,
          action: "strava_sync",
          entityType: "activity",
          metadata: {
            imported: result.imported,
            skipped: result.skipped,
            importedTypes: result.importedTypes,
            skippedTypes: result.skippedTypes,
            totalPoints: result.totalPoints,
            triggeredBy: "cron",
          },
        });
      }

      results.push({
        userId: user.id,
        name: user.name,
        imported: result.imported,
        skipped: result.skipped,
        totalPoints: result.totalPoints,
      });
    } catch (err) {
      console.error(`[sync-all] Failed for user ${user.id}:`, err);
      results.push({
        userId: user.id,
        name: user.name,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ results });
}
