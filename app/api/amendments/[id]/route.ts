import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { amendments, votes, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const amendmentId = parseInt(id, 10);

  const amendment = await db
    .select()
    .from(amendments)
    .where(eq(amendments.id, amendmentId))
    .get();

  if (!amendment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const amendmentVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.amendmentId, amendmentId));

  const allUsers = await db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(users);

  return NextResponse.json({
    ...amendment,
    votes: amendmentVotes,
    users: allUsers,
  });
}
