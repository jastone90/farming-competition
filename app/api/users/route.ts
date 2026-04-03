import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      color: users.color,
      stravaAthleteId: users.stravaAthleteId,
    })
    .from(users);
  return NextResponse.json(allUsers);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { name, pin, color } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be exactly 4 digits" }, { status: 400 });
  }

  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return NextResponse.json({ error: "Color must be a valid hex color" }, { status: 400 });
  }

  const trimmedName = name.trim();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.name}) = lower(${trimmedName})`);

  if (existing.length > 0) {
    return NextResponse.json({ error: "A user with that name already exists" }, { status: 409 });
  }

  const [newUser] = await db
    .insert(users)
    .values({
      name: trimmedName,
      pin,
      color,
    })
    .returning({
      id: users.id,
      name: users.name,
      color: users.color,
    });

  await logAudit({
    userId: session.id,
    action: "user_create",
    entityType: "user",
    entityId: newUser.id,
    metadata: { name: newUser.name, color: newUser.color },
  });

  return NextResponse.json(newUser, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { color } = body;

  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return NextResponse.json({ error: "Color must be a valid hex color" }, { status: 400 });
  }

  await db
    .update(users)
    .set({ color })
    .where(eq(users.id, session.id));

  await logAudit({
    userId: session.id,
    action: "color_change",
    entityType: "user",
    entityId: session.id,
    metadata: { oldColor: session.color, newColor: color },
  });

  return NextResponse.json({ id: session.id, color });
}
