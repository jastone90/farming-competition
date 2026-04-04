import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { syncUserActivities } from "@/lib/strava/sync";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await db.select().from(users).where(eq(users.id, session.id)).get();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const result = await syncUserActivities(user);

    await logAudit({
      userId: session.id,
      action: "strava_sync",
      entityType: "activity",
      metadata: {
        triggeredBy: "manual",
        imported: result.imported,
        skipped: result.skipped,
        importedTypes: result.importedTypes,
        skippedTypes: result.skippedTypes,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 400 }
    );
  }
}
