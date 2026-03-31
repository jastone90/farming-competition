import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { amendments, votes, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const amendmentId = parseInt(id, 10);
  const body = await request.json();
  const { vote } = body;

  if (!vote || !["yee", "nah"].includes(vote)) {
    return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
  }

  const amendment = await db
    .select()
    .from(amendments)
    .where(eq(amendments.id, amendmentId))
    .get();

  if (!amendment || amendment.status !== "voting") {
    return NextResponse.json({ error: "Amendment not open for voting" }, { status: 400 });
  }

  // Check if already voted
  const existing = await db
    .select()
    .from(votes)
    .where(and(eq(votes.amendmentId, amendmentId), eq(votes.userId, session.id)))
    .get();

  if (existing) {
    return NextResponse.json({ error: "Already voted" }, { status: 400 });
  }

  await db.insert(votes).values({
    amendmentId,
    userId: session.id,
    vote: vote as "yee" | "nah",
  });

  // Check if we have enough votes to resolve
  const allVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.amendmentId, amendmentId));

  const yeeCount = allVotes.filter((v) => v.vote === "yee").length;
  const nahCount = allVotes.filter((v) => v.vote === "nah").length;

  // Dynamic 3/4 supermajority based on total voter count
  const totalUsers = await db.select({ id: users.id }).from(users);
  const voterCount = totalUsers.length;
  const supermajority = Math.ceil(voterCount * 3 / 4);
  const rejectThreshold = voterCount - supermajority + 1; // enough nahs to make supermajority impossible

  if (yeeCount >= supermajority) {
    await db
      .update(amendments)
      .set({
        status: "approved",
        effectiveDate: `${amendment.season}-02-01`,
        votingClosesAt: new Date().toISOString(),
      })
      .where(and(eq(amendments.id, amendmentId), eq(amendments.status, "voting")));
  } else if (nahCount >= rejectThreshold) {
    await db
      .update(amendments)
      .set({
        status: "rejected",
        votingClosesAt: new Date().toISOString(),
      })
      .where(and(eq(amendments.id, amendmentId), eq(amendments.status, "voting")));
  }

  return NextResponse.json({ success: true, yeeCount, nahCount });
}
