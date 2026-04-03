import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { currentPin, newPin } = await request.json();

  if (!currentPin || !newPin) {
    return NextResponse.json({ error: "Current and new PIN required" }, { status: 400 });
  }

  if (!/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits" }, { status: 400 });
  }

  // Verify current PIN
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, session.id))
    .get();

  if (!user || user.pin !== currentPin) {
    return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 403 });
  }

  await db
    .update(users)
    .set({ pin: newPin })
    .where(eq(users.id, session.id));

  await logAudit({
    userId: session.id,
    action: "pin_change",
    entityType: "user",
    entityId: session.id,
    isSketch: true,
  });

  return NextResponse.json({ success: true });
}
