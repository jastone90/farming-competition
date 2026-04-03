import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { createUser, createActivity, createAuditEntry } from "../helpers/seed-helpers";
import { auditLog, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
});

afterEach(() => {
  testDb.close();
});

describe("audit log schema", () => {
  it("creates an audit entry with all fields", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_create",
      entityType: "activity",
      entityId: 42,
      metadata: JSON.stringify({ title: "Morning Run", points: 24.96 }),
      isSketch: false,
    });

    expect(entry.id).toBe(1);
    expect(entry.userId).toBe(1);
    expect(entry.action).toBe("activity_create");
    expect(entry.entityType).toBe("activity");
    expect(entry.entityId).toBe(42);
    expect(JSON.parse(entry.metadata)).toEqual({ title: "Morning Run", points: 24.96 });
    expect(entry.isSketch).toBe(false);
  });

  it("auto-increments id", async () => {
    await createUser(testDb, { name: "Alan" });

    const e1 = await createAuditEntry(testDb, { userId: 1, action: "activity_create", entityType: "activity" });
    const e2 = await createAuditEntry(testDb, { userId: 1, action: "activity_delete", entityType: "activity" });

    expect(e1.id).toBe(1);
    expect(e2.id).toBe(2);
  });

  it("defaults metadata to empty JSON object", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "pin_change",
      entityType: "user",
    });

    expect(entry.metadata).toBe("{}");
  });

  it("defaults isSketch to false", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_create",
      entityType: "activity",
    });

    expect(entry.isSketch).toBe(false);
  });

  it("stores isSketch = true for sketch entries", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_create",
      entityType: "activity",
      isSketch: true,
    });

    expect(entry.isSketch).toBe(true);
  });

  it("entityId is nullable", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "pin_change",
      entityType: "user",
    });

    expect(entry.entityId).toBeNull();
  });

  it("enforces foreign key on userId", async () => {
    await expect(
      createAuditEntry(testDb, {
        userId: 999,
        action: "activity_create",
        entityType: "activity",
      })
    ).rejects.toThrow();
  });
});

describe("audit log - all action types", () => {
  it("stores activity_create action", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_create",
      entityType: "activity",
      entityId: 1,
      metadata: JSON.stringify({ title: "Morning Run", type: "run", activityDate: "2026-03-15", points: 24.96, isIndoor: false }),
    });

    const meta = JSON.parse(entry.metadata);
    expect(entry.action).toBe("activity_create");
    expect(meta.title).toBe("Morning Run");
    expect(meta.type).toBe("run");
    expect(meta.points).toBe(24.96);
  });

  it("stores activity_delete action", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_delete",
      entityType: "activity",
      entityId: 1,
      metadata: JSON.stringify({ title: "Morning Run", type: "run", activityDate: "2026-03-15", points: 24.96 }),
    });

    expect(entry.action).toBe("activity_delete");
    expect(entry.entityType).toBe("activity");
  });

  it("stores amendment_propose action", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "amendment_propose",
      entityType: "amendment",
      entityId: 5,
      metadata: JSON.stringify({ title: "New rule", number: 23 }),
    });

    expect(entry.action).toBe("amendment_propose");
    expect(JSON.parse(entry.metadata).number).toBe(23);
  });

  it("stores amendment_withdraw action", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "amendment_withdraw",
      entityType: "amendment",
      entityId: 5,
      metadata: JSON.stringify({ title: "Bad rule", number: 23 }),
    });

    expect(entry.action).toBe("amendment_withdraw");
  });

  it("stores vote_cast action", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "vote_cast",
      entityType: "vote",
      entityId: 5,
      metadata: JSON.stringify({ amendmentNumber: 23, vote: "yee" }),
    });

    expect(entry.action).toBe("vote_cast");
    expect(JSON.parse(entry.metadata).vote).toBe("yee");
  });

  it("stores pin_change action without sensitive data", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "pin_change",
      entityType: "user",
      entityId: 1,
    });

    expect(entry.action).toBe("pin_change");
    expect(entry.metadata).toBe("{}");
  });

  it("stores user_create action with new user details", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "user_create",
      entityType: "user",
      entityId: 5,
      metadata: JSON.stringify({ name: "Charlie", color: "#AF52DE" }),
    });

    expect(entry.action).toBe("user_create");
    expect(entry.entityType).toBe("user");
    expect(entry.entityId).toBe(5);
    const meta = JSON.parse(entry.metadata);
    expect(meta.name).toBe("Charlie");
    expect(meta.color).toBe("#AF52DE");
  });

  it("stores color_change action with old and new colors", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "color_change",
      entityType: "user",
      entityId: 1,
      metadata: JSON.stringify({ oldColor: "#007AFF", newColor: "#AF52DE" }),
    });

    expect(entry.action).toBe("color_change");
    expect(entry.entityType).toBe("user");
    expect(entry.entityId).toBe(1);
    const meta = JSON.parse(entry.metadata);
    expect(meta.oldColor).toBe("#007AFF");
    expect(meta.newColor).toBe("#AF52DE");
  });
});

describe("audit log - sketch detection", () => {
  it("marks activity >21 days old as sketch", async () => {
    await createUser(testDb, { name: "Alan" });

    // Simulate what the activity create route does
    const activityDate = "2026-01-01";
    const now = new Date("2026-03-15T12:00:00Z");
    const daysDiff = Math.floor(
      (now.getTime() - new Date(activityDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(daysDiff).toBeGreaterThan(21);

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_create",
      entityType: "activity",
      entityId: 1,
      isSketch: daysDiff > 21,
      metadata: JSON.stringify({ title: "Backdated Run", activityDate }),
    });

    expect(entry.isSketch).toBe(true);
  });

  it("does NOT mark activity <=21 days old as sketch", async () => {
    await createUser(testDb, { name: "Alan" });

    const activityDate = "2026-03-10";
    const now = new Date("2026-03-15T12:00:00Z");
    const daysDiff = Math.floor(
      (now.getTime() - new Date(activityDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(daysDiff).toBeLessThanOrEqual(21);

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_create",
      entityType: "activity",
      entityId: 1,
      isSketch: daysDiff > 21,
    });

    expect(entry.isSketch).toBe(false);
  });

  it("activity exactly 21 days old is NOT sketch", async () => {
    const activityDate = "2026-02-22";
    const now = new Date("2026-03-15T12:00:00Z");
    const daysDiff = Math.floor(
      (now.getTime() - new Date(activityDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(daysDiff).toBe(21);
    expect(daysDiff > 21).toBe(false);
  });

  it("activity 22 days old IS sketch", async () => {
    const activityDate = "2026-02-21";
    const now = new Date("2026-03-15T12:00:00Z");
    const daysDiff = Math.floor(
      (now.getTime() - new Date(activityDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(daysDiff).toBe(22);
    expect(daysDiff > 21).toBe(true);
  });
});

describe("audit log - querying and filtering", () => {
  it("filters by userId", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });
    await createUser(testDb, { name: "Brian", color: "#34C759" });

    await createAuditEntry(testDb, { userId: 1, action: "activity_create", entityType: "activity" });
    await createAuditEntry(testDb, { userId: 2, action: "activity_create", entityType: "activity" });
    await createAuditEntry(testDb, { userId: 1, action: "pin_change", entityType: "user" });

    const alanEntries = await testDb.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.userId, 1));

    expect(alanEntries).toHaveLength(2);
  });

  it("filters by action type", async () => {
    await createUser(testDb, { name: "Alan" });

    await createAuditEntry(testDb, { userId: 1, action: "activity_create", entityType: "activity" });
    await createAuditEntry(testDb, { userId: 1, action: "activity_delete", entityType: "activity" });
    await createAuditEntry(testDb, { userId: 1, action: "pin_change", entityType: "user" });

    const creates = await testDb.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "activity_create"));

    expect(creates).toHaveLength(1);
  });

  it("filters by userId AND action combined", async () => {
    await createUser(testDb, { name: "Alan" });
    await createUser(testDb, { name: "Brian" });

    await createAuditEntry(testDb, { userId: 1, action: "activity_create", entityType: "activity" });
    await createAuditEntry(testDb, { userId: 1, action: "pin_change", entityType: "user" });
    await createAuditEntry(testDb, { userId: 2, action: "activity_create", entityType: "activity" });

    const results = await testDb.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, 1), eq(auditLog.action, "activity_create")));

    expect(results).toHaveLength(1);
  });

  it("orders by createdAt descending", async () => {
    await createUser(testDb, { name: "Alan" });

    await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_create",
      entityType: "activity",
      createdAt: "2026-03-01T10:00:00Z",
    });
    await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_delete",
      entityType: "activity",
      createdAt: "2026-03-15T10:00:00Z",
    });

    const rows = await testDb.db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt));

    expect(rows[0].action).toBe("activity_delete");
    expect(rows[1].action).toBe("activity_create");
  });

  it("joins with users table for name and color", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });
    await createAuditEntry(testDb, { userId: 1, action: "activity_create", entityType: "activity" });

    const rows = await testDb.db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        userName: users.name,
        userColor: users.color,
      })
      .from(auditLog)
      .innerJoin(users, eq(auditLog.userId, users.id));

    expect(rows).toHaveLength(1);
    expect(rows[0].userName).toBe("Alan");
    expect(rows[0].userColor).toBe("#007AFF");
  });

  it("limits results", async () => {
    await createUser(testDb, { name: "Alan" });

    for (let i = 0; i < 10; i++) {
      await createAuditEntry(testDb, { userId: 1, action: "activity_create", entityType: "activity" });
    }

    const limited = await testDb.db
      .select()
      .from(auditLog)
      .limit(5);

    expect(limited).toHaveLength(5);
  });
});

describe("audit log - metadata integrity", () => {
  it("stores and retrieves complex metadata as JSON", async () => {
    await createUser(testDb, { name: "Alan" });

    const metadata = {
      title: "Morning Run",
      type: "run",
      activityDate: "2026-03-15",
      points: 24.96,
      isIndoor: false,
    };

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_create",
      entityType: "activity",
      metadata: JSON.stringify(metadata),
    });

    const parsed = JSON.parse(entry.metadata);
    expect(parsed.title).toBe("Morning Run");
    expect(parsed.type).toBe("run");
    expect(parsed.points).toBe(24.96);
    expect(parsed.isIndoor).toBe(false);
    expect(parsed.activityDate).toBe("2026-03-15");
  });

  it("handles metadata with special characters", async () => {
    await createUser(testDb, { name: "Alan" });

    const metadata = {
      title: 'Amendment "SFUs" — special chars & more',
      number: 22,
    };

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "amendment_propose",
      entityType: "amendment",
      metadata: JSON.stringify(metadata),
    });

    const parsed = JSON.parse(entry.metadata);
    expect(parsed.title).toBe('Amendment "SFUs" — special chars & more');
  });
});

describe("audit log - cross-user scenarios", () => {
  it("multiple users create interleaved audit entries", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });
    await createUser(testDb, { name: "Brian", color: "#34C759" });
    await createUser(testDb, { name: "Martin", color: "#FF9500" });
    await createUser(testDb, { name: "Will", color: "#FF3B30" });

    await createAuditEntry(testDb, { userId: 1, action: "activity_create", entityType: "activity" });
    await createAuditEntry(testDb, { userId: 2, action: "vote_cast", entityType: "vote" });
    await createAuditEntry(testDb, { userId: 3, action: "amendment_propose", entityType: "amendment" });
    await createAuditEntry(testDb, { userId: 4, action: "pin_change", entityType: "user" });
    await createAuditEntry(testDb, { userId: 1, action: "activity_delete", entityType: "activity" });

    const all = await testDb.db.select().from(auditLog);
    expect(all).toHaveLength(5);

    // Verify each user's entries
    const user1 = all.filter((e) => e.userId === 1);
    expect(user1).toHaveLength(2);
    const user4 = all.filter((e) => e.userId === 4);
    expect(user4).toHaveLength(1);
    expect(user4[0].action).toBe("pin_change");
  });

  it("user_create audit links creator to new user", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });
    const newUser = await createUser(testDb, { name: "Charlie", color: "#AF52DE" });

    // Alan (id=1) created Charlie (id=2)
    await createAuditEntry(testDb, {
      userId: 1,
      action: "user_create",
      entityType: "user",
      entityId: newUser.id,
      metadata: JSON.stringify({ name: "Charlie", color: "#AF52DE" }),
    });

    const entries = await testDb.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user_create"));

    expect(entries).toHaveLength(1);
    expect(entries[0].userId).toBe(1); // creator
    expect(entries[0].entityId).toBe(2); // created user
    const meta = JSON.parse(entries[0].metadata);
    expect(meta.name).toBe("Charlie");
  });

  it("color_change audit tracks before and after", async () => {
    await createUser(testDb, { name: "Alan", color: "#007AFF" });

    await createAuditEntry(testDb, {
      userId: 1,
      action: "color_change",
      entityType: "user",
      entityId: 1,
      metadata: JSON.stringify({ oldColor: "#007AFF", newColor: "#BF5AF2" }),
      createdAt: "2026-03-10T10:00:00Z",
    });

    await createAuditEntry(testDb, {
      userId: 1,
      action: "color_change",
      entityType: "user",
      entityId: 1,
      metadata: JSON.stringify({ oldColor: "#BF5AF2", newColor: "#FFD60A" }),
      createdAt: "2026-03-15T10:00:00Z",
    });

    const entries = await testDb.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "color_change"))
      .orderBy(desc(auditLog.createdAt));

    expect(entries).toHaveLength(2);
    // Most recent change
    const latest = JSON.parse(entries[0].metadata);
    expect(latest.oldColor).toBe("#BF5AF2");
    expect(latest.newColor).toBe("#FFD60A");
    // First change
    const first = JSON.parse(entries[1].metadata);
    expect(first.oldColor).toBe("#007AFF");
    expect(first.newColor).toBe("#BF5AF2");
  });

  it("filters audit log by new action types", async () => {
    await createUser(testDb, { name: "Alan" });
    await createUser(testDb, { name: "Brian" });

    await createAuditEntry(testDb, { userId: 1, action: "user_create", entityType: "user", entityId: 2 });
    await createAuditEntry(testDb, { userId: 1, action: "color_change", entityType: "user", entityId: 1 });
    await createAuditEntry(testDb, { userId: 1, action: "activity_create", entityType: "activity" });
    await createAuditEntry(testDb, { userId: 2, action: "color_change", entityType: "user", entityId: 2 });

    const userCreates = await testDb.db.select().from(auditLog).where(eq(auditLog.action, "user_create"));
    expect(userCreates).toHaveLength(1);

    const colorChanges = await testDb.db.select().from(auditLog).where(eq(auditLog.action, "color_change"));
    expect(colorChanges).toHaveLength(2);
  });

  it("sketch entries are isolated per user", async () => {
    await createUser(testDb, { name: "Alan" });
    await createUser(testDb, { name: "Brian" });

    await createAuditEntry(testDb, { userId: 1, action: "activity_create", entityType: "activity", isSketch: true });
    await createAuditEntry(testDb, { userId: 2, action: "activity_create", entityType: "activity", isSketch: false });

    const sketchy = await testDb.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.isSketch, true));

    expect(sketchy).toHaveLength(1);
    expect(sketchy[0].userId).toBe(1);
  });
});
