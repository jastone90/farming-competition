import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { amendments, votes, users } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const allAmendments = await db
    .select()
    .from(amendments)
    .orderBy(desc(amendments.number));

  const allVotes = await db.select().from(votes);
  const allUsers = await db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(users);

  const result = allAmendments.map((a) => ({
    ...a,
    votes: allVotes.filter((v) => v.amendmentId === a.id),
    proposerName:
      allUsers.find((u) => u.id === a.proposedByUserId)?.name || "Unknown",
  }));

  return NextResponse.json({ amendments: result, users: allUsers });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { title, description, season: effectiveSeason } = body;

  if (!title || !description) {
    return NextResponse.json(
      { error: "Title and description required" },
      { status: 400 }
    );
  }

  // Atomically get next amendment number and insert in one statement
  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear();

  const [inserted] = await db
    .insert(amendments)
    .values({
      number: sql`(SELECT COALESCE(MAX(${amendments.number}), 0) + 1 FROM ${amendments})`,
      title,
      description,
      proposedByUserId: session.id,
      status: "voting",
      season: effectiveSeason || currentYear,
      votingOpensAt: now,
    })
    .returning();

  await logAudit({
    userId: session.id,
    action: "amendment_propose",
    entityType: "amendment",
    entityId: inserted.id,
    metadata: { title, number: inserted.number },
  });

  return NextResponse.json(inserted);
}
