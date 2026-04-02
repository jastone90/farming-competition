import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const activityId = parseInt(id, 10);

  const activity = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, session.id)))
    .get();

  if (!activity) {
    return NextResponse.json({ error: "Activity not found or not yours" }, { status: 404 });
  }

  const currentYear = new Date().getFullYear();
  if (activity.season !== currentYear) {
    return NextResponse.json({ error: "Cannot delete activities from past seasons" }, { status: 403 });
  }

  await db.delete(activities).where(and(eq(activities.id, activityId), eq(activities.userId, session.id)));
  return NextResponse.json({ success: true });
}
