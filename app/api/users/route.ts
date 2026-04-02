import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

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
