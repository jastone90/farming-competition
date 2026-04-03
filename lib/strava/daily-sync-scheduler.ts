import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";
import { syncUserActivities } from "@/lib/strava/sync";
import { logAudit } from "@/lib/audit";

const SYNC_HOUR = 6; // 6 AM local server time
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour

let lastSyncDate = "";

async function runDailySync() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Only sync once per day, at or after SYNC_HOUR
  if (now.getHours() < SYNC_HOUR || lastSyncDate === today) return;

  lastSyncDate = today;
  console.log(`[daily-sync] Starting automated sync at ${now.toISOString()}`);

  const connectedUsers = await db
    .select()
    .from(users)
    .where(isNotNull(users.stravaAthleteId))
    .all();

  if (!connectedUsers.length) {
    console.log("[daily-sync] No connected users, skipping");
    return;
  }

  const after = Math.floor(
    new Date(now.getFullYear(), 0, 1).getTime() / 1000
  );

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
            triggeredBy: "scheduled",
          },
        });
      }

      console.log(
        `[daily-sync] ${user.name}: imported=${result.imported}, skipped=${result.skipped}`
      );
    } catch (err) {
      console.error(`[daily-sync] Failed for ${user.name}:`, err);
    }
  }

  console.log("[daily-sync] Complete");
}

export function startDailySyncScheduler() {
  console.log(
    `[daily-sync] Scheduler started, will sync daily at ${SYNC_HOUR}:00`
  );

  // Check immediately on startup (in case server starts after SYNC_HOUR)
  setTimeout(runDailySync, 5000);

  // Then check every hour
  setInterval(runDailySync, CHECK_INTERVAL_MS);
}
