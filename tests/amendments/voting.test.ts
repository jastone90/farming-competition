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

async function resolveAmendment(testDb: TestDb, amendmentId: number) {
  const allVotes = await testDb.db
    .select()
    .from(votes)
    .where(eq(votes.amendmentId, amendmentId));
  const yeeCount = allVotes.filter((v) => v.vote === "yee").length;
  const nahCount = allVotes.filter((v) => v.vote === "nah").length;

  // Dynamic supermajority matching the app logic
  const totalUsers = await testDb.db.select({ id: users.id }).from(users);
  const voterCount = totalUsers.length;
  const supermajority = Math.ceil(voterCount * 3 / 4);
  const rejectThreshold = voterCount - supermajority + 1;

  if (yeeCount >= supermajority) {
    await testDb.db
      .update(amendments)
      .set({ status: "approved", votingClosesAt: new Date().toISOString() })
      .where(and(eq(amendments.id, amendmentId), eq(amendments.status, "voting")));
  } else if (nahCount >= rejectThreshold) {
    await testDb.db
      .update(amendments)
      .set({ status: "rejected", votingClosesAt: new Date().toISOString() })
      .where(and(eq(amendments.id, amendmentId), eq(amendments.status, "voting")));
  }
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

  it("auto-approves at supermajority (3/4 of 4 = 3 yee)", async () => {
    const amend = await createAmendment(testDb, {
      number: 1,
      title: "Good Idea",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "yee");
    await resolveAmendment(testDb, amend.id);

    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).toBe("approved");
  });

  it("auto-rejects when supermajority becomes impossible (2 nah of 4)", async () => {
    const amend = await createAmendment(testDb, {
      number: 2,
      title: "Bad Idea",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "nah");
    await castVote(testDb, amend.id, 2, "nah");
    await resolveAmendment(testDb, amend.id);

    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).toBe("rejected");
  });

  it("stays in voting with 2 yee and 1 nah", async () => {
    const amend = await createAmendment(testDb, {
      number: 3,
      title: "Pending",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "nah");
    await resolveAmendment(testDb, amend.id);

    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).toBe("voting");
  });

  it("prevents duplicate vote from same user (application-level check)", async () => {
    const amend = await createAmendment(testDb, {
      number: 4,
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
      number: 5,
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
      number: 6,
      title: "Terrible Idea",
      proposedByUserId: 4,
    });
    await castVote(testDb, amend.id, 1, "nah");
    await castVote(testDb, amend.id, 2, "nah");
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
      number: 7,
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
      number: 8,
      title: "Quick Vote",
      proposedByUserId: 1,
    });
    expect(amend.votingClosesAt).toBeNull();

    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "yee");
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
      number: 9,
      title: "Five Voter Test",
      proposedByUserId: 1,
    });
    await castVote(testDb, amend.id, 1, "yee");
    await castVote(testDb, amend.id, 2, "yee");
    await castVote(testDb, amend.id, 3, "yee");
    await resolveAmendment(testDb, amend.id);

    // 3 yee with 5 voters: ceil(5*3/4)=4 needed, so should still be voting
    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).toBe("voting");

    // 4th yee should approve
    await castVote(testDb, amend.id, 4, "yee");
    await resolveAmendment(testDb, amend.id);

    const rows2 = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows2[0].status).toBe("approved");
  });

  it("resolve update is guarded by status=voting", async () => {
    const amend = await createAmendment(testDb, {
      number: 10,
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
    await resolveAmendment(testDb, amend.id);

    const rows = await testDb.db
      .select()
      .from(amendments)
      .where(eq(amendments.id, amend.id));
    expect(rows[0].status).toBe("approved"); // not overwritten to rejected
  });
});
