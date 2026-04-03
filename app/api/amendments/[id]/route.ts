import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { amendments, votes, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

  if (amendment.status !== "voting") {
    return NextResponse.json({ error: "Can only delete amendments while voting is open" }, { status: 400 });
  }

  if (amendment.proposedByUserId !== session.id) {
    return NextResponse.json({ error: "Only the proposer can delete this amendment" }, { status: 403 });
  }

  // Delete votes first (foreign key), then the amendment
  await db.delete(votes).where(eq(votes.amendmentId, amendmentId));
  await db.delete(amendments).where(eq(amendments.id, amendmentId));

  await logAudit({
    userId: session.id,
    action: "amendment_withdraw",
    entityType: "amendment",
    entityId: amendmentId,
    metadata: { title: amendment.title, number: amendment.number },
  });

  return NextResponse.json({ success: true });
}
