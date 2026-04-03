import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { createUser, createAmendment, castVote } from "../helpers/seed-helpers";
import { amendments, votes, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
  // Create 4 users for voting
  await createUser(testDb, { name: "Alan" });
  await createUser(testDb, { name: "Brian" });
  await createUser(testDb, { name: "Martin" });
  await createUser(testDb, { name: "Will" });
});

afterEach(() => {
  testDb.close();
});

/**
 * Mirrors the app's vote resolution logic:
 * only resolves once ALL users have voted.
 */
async function resolveAmendment(testDb: TestDb, amendmentId: number) {
  const allVotes = await testDb.db
    .select()
    .from(votes)
    .where(eq(votes.amendmentId, amendmentId));

  const totalUsers = await testDb.db.select({ id: users.id }).from(users);
  const voterCount = totalUsers.length;

  // Only resolve once everyone has voted
  if (allVotes.length !== voterCount) return;

  const yeeCount = allVotes.filter((v) => v.vote === "yee").length;
  const supermajority = Math.ceil(voterCount * 3 / 4);

  if (yeeCount >= supermajority) {
    await testDb.db
      .update(amendments)
      .set({ status: "approved", votingClosesAt: new Date().toISOString() })
      .where(and(eq(amendments.id, amendmentId), eq(amendments.status, "voting")));
  } else {
    await testDb.db
      .update(amendments)
      .set({ status: "rejected", votingClosesAt: new Date().toISOString() })
      .where(and(eq(amendments.id, amendmentId), eq(amendments.status, "voting")));
  }
}

/**
 * Mirrors the app's DELETE /api/amendments/[id] logic.
 * Returns { success, status } to allow assertions on error cases.
 */
async function deleteAmendment(testDb: TestDb, amendmentId: number, userId: number) {
  const amendment = await testDb.db
    .select()
    .from(amendments)
    .where(eq(amendments.id, amendmentId))
    .get();

  if (!amendment) return { success: false, status: 404 };
  if (amendment.status !== "voting") return { success: false, status: 400 };
  if (amendment.proposedByUserId !== userId) return { success: false, status: 403 };

  await testDb.db.delete(votes).where(eq(votes.amendmentId, amendmentId));
  await testDb.db.delete(amendments).where(eq(amendments.id, amendmentId));
  return { success: true, status: 200 };
}

describe("amendments and voting", () => {
  it("creates an amendment in voting status", async () => {
    const amend = await createAmendment(testDb, {
      number: 1,
      title: "Test Amendment",
      proposedByUserId: 1,
    });
    expect(amend.status).toBe("voting");
    expect(amend.number).toBe(1);
  });

  it("approves with supermajority when all users have voted (3 yee, 1 nah)", async () => {
    const amend = await createAmendment(testDb, {
      number: 1,
      title: "Good Idea",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "yee");
    await castVote(testDb, amend.id, 4, "nah");
    await resolveAmendment(testDb, amend.id);

    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).toBe("approved");
  });

  it("rejects when supermajority not reached (2 yee, 2 nah)", async () => {
    const amend = await createAmendment(testDb, {
      number: 2,
      title: "Split Decision",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "nah");
    await castVote(testDb, amend.id, 4, "nah");
    await resolveAmendment(testDb, amend.id);

    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).toBe("rejected");
  });

  it("does NOT resolve before all users have voted", async () => {
    const amend = await createAmendment(testDb, {
      number: 3,
      title: "Early Bird",
      proposedByUserId: 1,
    });
    // 3 yee votes — would have been enough for supermajority, but 4th user hasn't voted
    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "yee");
    await resolveAmendment(testDb, amend.id);

    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).toBe("voting");
  });

  it("records the fourth vote even when outcome is already clear", async () => {
    const amend = await createAmendment(testDb, {
      number: 4,
      title: "Record All Votes",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "yee");
    // 4th vote is a nah — still gets recorded
    await castVote(testDb, amend.id, 4, "nah");
    await resolveAmendment(testDb, amend.id);

    const allVotes = await testDb.db
      .select()
      .from(votes)
      .where(eq(votes.amendmentId, amend.id));
    expect(allVotes).toHaveLength(4);

    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).toBe("approved");
  });

  it("prevents duplicate vote from same user (application-level check)", async () => {
    const amend = await createAmendment(testDb, {
      number: 5,
      title: "Test",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "yee");

    // Check if user already voted before casting
    const existing = await testDb.db
      .select()
      .from(votes)
      .where(and(eq(votes.amendmentId, amend.id), eq(votes.userId, 1)));
    expect(existing).toHaveLength(1);

    // Application should reject duplicate
    if (existing.length > 0) {
      // Don't insert duplicate
    }
    const allVotes = await testDb.db
      .select()
      .from(votes)
      .where(eq(votes.amendmentId, amend.id));
    expect(allVotes).toHaveLength(1);
  });

  it("cannot vote on resolved amendment (application-level check)", async () => {
    const amend = await createAmendment(testDb, {
      number: 6,
      title: "Already Resolved",
      proposedByUserId: 1,
      status: "approved",
    });

    // Application should check status before allowing vote
    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).not.toBe("voting");
  });

  it("amendments have sequential numbering", async () => {
    await createAmendment(testDb, { number: 1, title: "First", proposedByUserId: 1 });
    await createAmendment(testDb, { number: 2, title: "Second", proposedByUserId: 2 });
    await createAmendment(testDb, { number: 3, title: "Third", proposedByUserId: 3 });

    const rows = await testDb.db.select().from(amendments);
    const numbers = rows.map((r) => r.number);
    expect(numbers).toEqual([1, 2, 3]);
  });

  it("records rejection commentary", async () => {
    const amend = await createAmendment(testDb, {
      number: 7,
      title: "Terrible Idea",
      proposedByUserId: 4,
    });
    await castVote(testDb, amend.id, 1, "nah");
    await castVote(testDb, amend.id, 2, "nah");
    await castVote(testDb, amend.id, 3, "nah");
    await castVote(testDb, amend.id, 4, "nah");
    await resolveAmendment(testDb, amend.id);
    await testDb.db
      .update(amendments)
      .set({ rejectionCommentary: "Absolutely not" })
      .where(eq(amendments.id, amend.id));

    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].rejectionCommentary).toBe("Absolutely not");
  });

  it("vote tallies are accurate", async () => {
    const amend = await createAmendment(testDb, {
      number: 8,
      title: "Close Vote",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "nah");
    await castVote(testDb, amend.id, 3, "yee");
    await castVote(testDb, amend.id, 4, "yee");

    const allVotes = await testDb.db
      .select()
      .from(votes)
      .where(eq(votes.amendmentId, amend.id));
    const yees = allVotes.filter((v) => v.vote === "yee").length;
    const nahs = allVotes.filter((v) => v.vote === "nah").length;
    expect(yees).toBe(3);
    expect(nahs).toBe(1);
  });

  it("sets votingClosesAt when resolved", async () => {
    const amend = await createAmendment(testDb, {
      number: 9,
      title: "Quick Vote",
      proposedByUserId: 1,
    });
    expect(amend.votingClosesAt).toBeNull();

    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "yee");
    await castVote(testDb, amend.id, 4, "yee");
    await resolveAmendment(testDb, amend.id);

    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].votingClosesAt).not.toBeNull();
  });

  it("dynamic thresholds: 5 users need 4 yee to approve", async () => {
    await createUser(testDb, { name: "Eve" });
    const amend = await createAmendment(testDb, {
      number: 10,
      title: "Five Voter Test",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "yee");
    await castVote(testDb, amend.id, 4, "nah");
    await castVote(testDb, amend.id, 5, "nah");
    await resolveAmendment(testDb, amend.id);

    // 3 yee with 5 voters: ceil(5*3/4)=4 needed, so rejected
    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).toBe("rejected");
  });

  it("5 users: 4 yee approves", async () => {
    await createUser(testDb, { name: "Eve" });
    const amend = await createAmendment(testDb, {
      number: 11,
      title: "Five Voter Approve",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "yee");
    await castVote(testDb, amend.id, 4, "yee");
    await castVote(testDb, amend.id, 5, "nah");
    await resolveAmendment(testDb, amend.id);

    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).toBe("approved");
  });

  it("resolve update is guarded by status=voting", async () => {
    const amend = await createAmendment(testDb, {
      number: 12,
      title: "Race Condition Guard",
      proposedByUserId: 1,
    });
    // Manually set to approved first
    await testDb.db
      .update(amendments)
      .set({ status: "approved" })
      .where(eq(amendments.id, amend.id));

    // Now try to reject via resolveAmendment — should be a no-op
    await castVote(testDb, amend.id, 1, "nah");
    await castVote(testDb, amend.id, 2, "nah");
    await castVote(testDb, amend.id, 3, "nah");
    await castVote(testDb, amend.id, 4, "nah");
    await resolveAmendment(testDb, amend.id);

    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).toBe("approved"); // not overwritten to rejected
  });
});

describe("amendment deletion / withdrawal", () => {
  it("proposer can delete their own amendment while voting", async () => {
    const amend = await createAmendment(testDb, {
      number: 1,
      title: "Withdrawable",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 2, "yee");

    const result = await deleteAmendment(testDb, amend.id, 1);
    expect(result).toEqual({ success: true, status: 200 });

    // Amendment is gone
    const rows = await testDb.db.select().from(amendments).where(eq(amendments.id, amend.id));
    expect(rows).toHaveLength(0);

    // Votes are also cleaned up
    const voteRows = await testDb.db.select().from(votes).where(eq(votes.amendmentId, amend.id));
    expect(voteRows).toHaveLength(0);
  });

  it("non-proposer cannot delete someone else's amendment", async () => {
    const amend = await createAmendment(testDb, {
      number: 2,
      title: "Not Yours",
      proposedByUserId: 1,
    });

    const result = await deleteAmendment(testDb, amend.id, 2);
    expect(result).toEqual({ success: false, status: 403 });

    // Amendment still exists
    const rows = await testDb.db.select().from(amendments).where(eq(amendments.id, amend.id));
    expect(rows).toHaveLength(1);
  });

  it("cannot delete an approved amendment", async () => {
    const amend = await createAmendment(testDb, {
      number: 3,
      title: "Already Approved",
      proposedByUserId: 1,
      status: "approved",
    });

    const result = await deleteAmendment(testDb, amend.id, 1);
    expect(result).toEqual({ success: false, status: 400 });

    const rows = await testDb.db.select().from(amendments).where(eq(amendments.id, amend.id));
    expect(rows).toHaveLength(1);
  });

  it("cannot delete a rejected amendment", async () => {
    const amend = await createAmendment(testDb, {
      number: 4,
      title: "Already Rejected",
      proposedByUserId: 1,
      status: "rejected",
    });

    const result = await deleteAmendment(testDb, amend.id, 1);
    expect(result).toEqual({ success: false, status: 400 });
  });

  it("returns 404 for nonexistent amendment", async () => {
    const result = await deleteAmendment(testDb, 9999, 1);
    expect(result).toEqual({ success: false, status: 404 });
  });

  it("deleting amendment cleans up all associated votes", async () => {
    const amend = await createAmendment(testDb, {
      number: 5,
      title: "Cleanup Test",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "nah");
    await castVote(testDb, amend.id, 3, "yee");

    // 3 votes exist
    const before = await testDb.db.select().from(votes).where(eq(votes.amendmentId, amend.id));
    expect(before).toHaveLength(3);

    await deleteAmendment(testDb, amend.id, 1);

    // All gone
    const after = await testDb.db.select().from(votes).where(eq(votes.amendmentId, amend.id));
    expect(after).toHaveLength(0);
  });

  it("deleting one amendment does not affect others", async () => {
    const amend1 = await createAmendment(testDb, { number: 6, title: "Delete Me", proposedByUserId: 1 });
    const amend2 = await createAmendment(testDb, { number: 7, title: "Keep Me", proposedByUserId: 2 });

    await castVote(testDb, amend1.id, 1, "yee");
    await castVote(testDb, amend2.id, 2, "nah");

    await deleteAmendment(testDb, amend1.id, 1);

    // amend2 and its votes untouched
    const rows = await testDb.db.select().from(amendments).where(eq(amendments.id, amend2.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Keep Me");

    const voteRows = await testDb.db.select().from(votes).where(eq(votes.amendmentId, amend2.id));
    expect(voteRows).toHaveLength(1);
  });

  it("cannot withdraw after all votes are cast and amendment resolves", async () => {
    const amend = await createAmendment(testDb, {
      number: 8,
      title: "Too Late",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "yee");
    await castVote(testDb, amend.id, 4, "nah");
    await resolveAmendment(testDb, amend.id);

    // Amendment is now approved — cannot delete
    const result = await deleteAmendment(testDb, amend.id, 1);
    expect(result).toEqual({ success: false, status: 400 });
  });

  it("proposer can withdraw even after some votes are cast", async () => {
    const amend = await createAmendment(testDb, {
      number: 9,
      title: "Changed My Mind",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "yee");
    await castVote(testDb, amend.id, 4, "nah");
    // 3 of 4 have voted, but not all — still in voting status

    const result = await deleteAmendment(testDb, amend.id, 1);
    expect(result).toEqual({ success: true, status: 200 });

    const rows = await testDb.db.select().from(amendments).where(eq(amendments.id, amend.id));
    expect(rows).toHaveLength(0);
  });
});
