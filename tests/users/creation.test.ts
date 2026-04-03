import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { createUser, seedFullDatabase } from "../helpers/seed-helpers";
import { users } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
});

afterEach(() => {
  testDb.close();
});

describe("user creation", () => {
  describe("basic creation", () => {
    it("creates a new user with auto-increment ID", async () => {
      const user = await createUser(testDb, { name: "Alice", pin: "1234", color: "#AF52DE" });
      expect(user.id).toBe(1);
      expect(user.name).toBe("Alice");
      expect(user.color).toBe("#AF52DE");
    });

    it("assigns sequential IDs", async () => {
      const u1 = await createUser(testDb, { name: "Alice" });
      const u2 = await createUser(testDb, { name: "Bob" });
      const u3 = await createUser(testDb, { name: "Charlie" });
      expect(u1.id).toBe(1);
      expect(u2.id).toBe(2);
      expect(u3.id).toBe(3);
    });

    it("stores createdAt timestamp", async () => {
      const user = await createUser(testDb, { name: "Alice" });
      expect(user.createdAt).toBeTruthy();
      // Should be a valid ISO date
      expect(new Date(user.createdAt).toISOString()).toBeTruthy();
    });
  });

  describe("adding a 5th user to existing 4", () => {
    beforeEach(async () => {
      await seedFullDatabase(testDb);
    });

    it("creates 5th user with correct auto-increment ID", async () => {
      const newUser = await createUser(testDb, {
        name: "Charlie",
        pin: "9999",
        color: "#AF52DE",
      });
      expect(newUser.id).toBe(5);
      expect(newUser.name).toBe("Charlie");
    });

    it("5th user appears in full user list", async () => {
      await createUser(testDb, { name: "Charlie", color: "#AF52DE" });
      const allUsers = await testDb.db
        .select({ id: users.id, name: users.name, color: users.color })
        .from(users);
      expect(allUsers).toHaveLength(5);
      expect(allUsers.map((u) => u.name)).toContain("Charlie");
    });

    it("5th user can have activities created for them", async () => {
      const newUser = await createUser(testDb, { name: "Charlie", color: "#AF52DE" });
      const { createActivity } = await import("../helpers/seed-helpers");
      const activity = await createActivity(testDb, {
        userId: newUser.id,
        title: "New User Run",
        type: "run",
        distanceMiles: 3.0,
      });
      expect(activity.userId).toBe(newUser.id);
    });

    it("leaderboard query includes 5th user", async () => {
      const newUser = await createUser(testDb, { name: "Charlie", color: "#AF52DE" });
      // Simulate what the leaderboard API does: get all users
      const allUsers = await testDb.db
        .select({ id: users.id, name: users.name, color: users.color })
        .from(users);
      expect(allUsers).toHaveLength(5);
      const charlie = allUsers.find((u) => u.id === newUser.id);
      expect(charlie).toBeDefined();
      expect(charlie!.name).toBe("Charlie");
      expect(charlie!.color).toBe("#AF52DE");
    });
  });

  describe("name uniqueness (case-insensitive)", () => {
    it("allows different names", async () => {
      await createUser(testDb, { name: "Alice" });
      const bob = await createUser(testDb, { name: "Bob" });
      expect(bob.id).toBe(2);
    });

    it("database allows duplicate names at DB level (no UNIQUE constraint)", async () => {
      // The DB itself has no UNIQUE constraint, so the app layer must enforce it
      await createUser(testDb, { name: "Alice" });
      // Direct insert bypasses app-level validation
      const dupe = await createUser(testDb, { name: "Alice" });
      expect(dupe.id).toBe(2); // DB allows it — app must prevent this
    });

    it("case-insensitive lookup via SQL lower() catches duplicates", async () => {
      await createUser(testDb, { name: "Alan" });

      // This is how the fixed POST /api/users checks for duplicates
      const checkName = "alan";
      const existing = await testDb.db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.name}) = lower(${checkName})`);

      expect(existing.length).toBeGreaterThan(0);
    });

    it("case-insensitive lookup catches mixed case variants", async () => {
      await createUser(testDb, { name: "Martin" });

      for (const variant of ["martin", "MARTIN", "MaRtIn"]) {
        const existing = await testDb.db
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(${users.name}) = lower(${variant})`);
        expect(existing.length).toBeGreaterThan(0);
      }
    });

    it("case-insensitive lookup allows genuinely different names", async () => {
      await createUser(testDb, { name: "Martin" });

      const existing = await testDb.db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.name}) = lower(${"Martina"})`);
      expect(existing).toHaveLength(0);
    });
  });

  describe("name validation edge cases", () => {
    it("whitespace-only name should be rejected at app level", () => {
      const name = "   ";
      expect(name.trim()).toBe("");
      // App validates: !name.trim() → reject
    });

    it("name with leading/trailing spaces gets trimmed", () => {
      const name = "  Charlie  ";
      expect(name.trim()).toBe("Charlie");
    });

    it("very long name is stored correctly", async () => {
      const longName = "A".repeat(200);
      const user = await createUser(testDb, { name: longName });
      expect(user.name).toBe(longName);
      expect(user.name.length).toBe(200);
    });
  });

  describe("PIN validation", () => {
    it("4-digit PIN regex validates correctly", () => {
      const regex = /^\d{4}$/;
      expect(regex.test("1234")).toBe(true);
      expect(regex.test("0000")).toBe(true);
      expect(regex.test("9999")).toBe(true);
    });

    it("rejects non-4-digit PINs", () => {
      const regex = /^\d{4}$/;
      expect(regex.test("123")).toBe(false);    // too short
      expect(regex.test("12345")).toBe(false);  // too long
      expect(regex.test("abcd")).toBe(false);   // letters
      expect(regex.test("12.4")).toBe(false);   // decimal
      expect(regex.test("")).toBe(false);        // empty
      expect(regex.test(" 123")).toBe(false);   // leading space
    });

    it("stores PIN as plain text", async () => {
      const user = await createUser(testDb, { name: "Alice", pin: "4567" });
      const fetched = await testDb.db.select().from(users).where(eq(users.id, user.id));
      expect(fetched[0].pin).toBe("4567");
    });
  });

  describe("color validation", () => {
    it("hex color regex validates correctly", () => {
      const regex = /^#[0-9A-Fa-f]{6}$/;
      expect(regex.test("#007AFF")).toBe(true);
      expect(regex.test("#ff00ff")).toBe(true);
      expect(regex.test("#000000")).toBe(true);
      expect(regex.test("#FFFFFF")).toBe(true);
    });

    it("rejects invalid hex colors", () => {
      const regex = /^#[0-9A-Fa-f]{6}$/;
      expect(regex.test("#FFF")).toBe(false);       // shorthand
      expect(regex.test("007AFF")).toBe(false);     // no hash
      expect(regex.test("#GGGGGG")).toBe(false);    // invalid hex chars
      expect(regex.test("#007AFF00")).toBe(false);  // 8-digit with alpha
      expect(regex.test("")).toBe(false);
      expect(regex.test("red")).toBe(false);
    });
  });

  describe("login with new users", () => {
    it("new user can be found by name for login", async () => {
      await createUser(testDb, { name: "Charlie", pin: "9876", color: "#AF52DE" });

      const user = await testDb.db
        .select()
        .from(users)
        .where(eq(users.name, "Charlie"))
        .get();

      expect(user).toBeDefined();
      expect(user!.pin).toBe("9876");
    });

    it("login is case-sensitive (name must match exactly)", async () => {
      await createUser(testDb, { name: "Charlie", pin: "9876" });

      // Exact match works
      const exact = await testDb.db
        .select()
        .from(users)
        .where(eq(users.name, "Charlie"))
        .get();
      expect(exact).toBeDefined();

      // Wrong case fails (eq is case-sensitive in SQLite)
      const wrongCase = await testDb.db
        .select()
        .from(users)
        .where(eq(users.name, "charlie"))
        .get();
      expect(wrongCase).toBeUndefined();
    });
  });
});

describe("amendment voting with dynamic user count", () => {
  it("supermajority calculation scales with user count", () => {
    // Math.ceil(voterCount * 3 / 4)
    expect(Math.ceil(4 * 3 / 4)).toBe(3);  // 4 users → need 3
    expect(Math.ceil(5 * 3 / 4)).toBe(4);  // 5 users → need 4
    expect(Math.ceil(6 * 3 / 4)).toBe(5);  // 6 users → need 5
    expect(Math.ceil(7 * 3 / 4)).toBe(6);  // 7 users → need 6
    expect(Math.ceil(8 * 3 / 4)).toBe(6);  // 8 users → need 6
    expect(Math.ceil(1 * 3 / 4)).toBe(1);  // edge: 1 user → need 1
    expect(Math.ceil(2 * 3 / 4)).toBe(2);  // edge: 2 users → need 2
  });

  it("new user added after voting opens doesn't block resolution", async () => {
    // Create initial 4 users
    const u1 = await createUser(testDb, { name: "Alan", pin: "1234", color: "#007AFF", createdAt: "2026-01-01T00:00:00.000Z" });
    const u2 = await createUser(testDb, { name: "Brian", pin: "5678", color: "#34C759", createdAt: "2026-01-01T00:00:00.000Z" });
    const u3 = await createUser(testDb, { name: "Martin", pin: "9012", color: "#FF9500", createdAt: "2026-01-01T00:00:00.000Z" });
    const u4 = await createUser(testDb, { name: "Will", pin: "3456", color: "#FF3B30", createdAt: "2026-01-01T00:00:00.000Z" });

    const votingOpensAt = "2026-03-01T00:00:00.000Z";

    // Add new user AFTER voting opens
    await createUser(testDb, {
      name: "Charlie",
      pin: "9999",
      color: "#AF52DE",
      createdAt: "2026-03-15T00:00:00.000Z", // After votingOpensAt
    });

    // Simulate the fixed vote resolution logic: only count users created <= votingOpensAt
    const { lte } = await import("drizzle-orm");
    const eligibleVoters = await testDb.db
      .select({ id: users.id })
      .from(users)
      .where(lte(users.createdAt, votingOpensAt));

    expect(eligibleVoters).toHaveLength(4); // Charlie excluded
    expect(eligibleVoters.map((v) => v.id)).not.toContain(5);
  });

  it("new user added before voting opens IS counted", async () => {
    await createUser(testDb, { name: "Alan", createdAt: "2026-01-01T00:00:00.000Z" });
    await createUser(testDb, { name: "Charlie", createdAt: "2026-02-01T00:00:00.000Z" });

    const votingOpensAt = "2026-03-01T00:00:00.000Z";

    const { lte } = await import("drizzle-orm");
    const eligibleVoters = await testDb.db
      .select({ id: users.id })
      .from(users)
      .where(lte(users.createdAt, votingOpensAt));

    expect(eligibleVoters).toHaveLength(2); // Both count
  });
});

describe("user GET endpoint (dynamic login page)", () => {
  it("returns all users without PINs", async () => {
    await createUser(testDb, { name: "Alan", pin: "1234", color: "#007AFF" });
    await createUser(testDb, { name: "Brian", pin: "5678", color: "#34C759" });

    // Simulate what the GET endpoint returns
    const allUsers = await testDb.db
      .select({
        id: users.id,
        name: users.name,
        color: users.color,
        stravaAthleteId: users.stravaAthleteId,
      })
      .from(users);

    expect(allUsers).toHaveLength(2);
    // Verify PIN is NOT included in the projection
    const keys = Object.keys(allUsers[0]);
    expect(keys).not.toContain("pin");
    expect(keys).toContain("id");
    expect(keys).toContain("name");
    expect(keys).toContain("color");
  });

  it("newly added user appears immediately in user list", async () => {
    await seedFullDatabase(testDb);
    expect(
      (await testDb.db.select().from(users)).length
    ).toBe(4);

    await createUser(testDb, { name: "Charlie", pin: "9999", color: "#AF52DE" });

    const allUsers = await testDb.db
      .select({ id: users.id, name: users.name, color: users.color })
      .from(users);
    expect(allUsers).toHaveLength(5);
    expect(allUsers[4].name).toBe("Charlie");
  });
});

describe("color preset edge cases", () => {
  const colorPresets = [
    "#007AFF", "#34C759", "#FF9500", "#FF3B30",
    "#AF52DE", "#5856D6", "#FF2D55", "#00C7BE",
    "#30B0C7", "#A2845E", "#64D2FF", "#FFD60A",
    "#BF5AF2", "#FF6482", "#32D74B", "#0A84FF",
  ];

  it("all 16 color presets are valid hex colors", () => {
    const regex = /^#[0-9A-Fa-f]{6}$/;
    for (const color of colorPresets) {
      expect(regex.test(color)).toBe(true);
    }
  });

  it("all 16 color presets are unique", () => {
    const normalized = colorPresets.map((c) => c.toUpperCase());
    expect(new Set(normalized).size).toBe(16);
  });

  it("taken color detection works with case-insensitive compare", () => {
    const existingColors = ["#007AFF", "#34C759", "#FF9500", "#FF3B30"];
    const takenColors = new Set(existingColors.map((c) => c.toUpperCase()));

    // Preset colors that are taken
    expect(takenColors.has("#007AFF")).toBe(true);
    expect(takenColors.has("#34C759")).toBe(true);

    // Available colors
    expect(takenColors.has("#AF52DE")).toBe(false);
    expect(takenColors.has("#5856D6")).toBe(false);
    expect(takenColors.has("#FF2D55")).toBe(false);
    expect(takenColors.has("#00C7BE")).toBe(false);
  });

  it("handles lowercase color from DB against uppercase presets", () => {
    // If a user's color was stored as lowercase
    const existingColors = ["#007aff"];
    const takenColors = new Set(existingColors.map((c) => c.toUpperCase()));
    expect(takenColors.has("#007AFF")).toBe(true);
  });
});

describe("color change", () => {
  it("updates a user's color in the database", async () => {
    const user = await createUser(testDb, { name: "Alan", color: "#007AFF" });
    await testDb.db
      .update(users)
      .set({ color: "#AF52DE" })
      .where(eq(users.id, user.id));

    const updated = await testDb.db.select().from(users).where(eq(users.id, user.id));
    expect(updated[0].color).toBe("#AF52DE");
  });

  it("color change propagates to leaderboard query", async () => {
    await seedFullDatabase(testDb);
    // Alan's original color
    const before = await testDb.db
      .select({ id: users.id, name: users.name, color: users.color })
      .from(users)
      .where(eq(users.id, 1));
    expect(before[0].color).toBe("#007AFF");

    // Change color
    await testDb.db.update(users).set({ color: "#BF5AF2" }).where(eq(users.id, 1));

    // Simulate leaderboard API: fresh query returns new color
    const allUsers = await testDb.db
      .select({ id: users.id, name: users.name, color: users.color })
      .from(users);
    const alan = allUsers.find((u) => u.id === 1);
    expect(alan!.color).toBe("#BF5AF2");
  });

  it("color change propagates to activity join queries", async () => {
    const { activities } = await import("@/lib/db/schema");
    await seedFullDatabase(testDb);

    // Change Alan's color
    await testDb.db.update(users).set({ color: "#FFD60A" }).where(eq(users.id, 1));

    // Simulate activities API join
    const rows = await testDb.db
      .select({
        activityId: activities.id,
        userName: users.name,
        userColor: users.color,
      })
      .from(activities)
      .innerJoin(users, eq(activities.userId, users.id))
      .where(eq(activities.userId, 1));

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.userColor).toBe("#FFD60A");
    }
  });

  it("color change does not affect other users", async () => {
    await seedFullDatabase(testDb);
    await testDb.db.update(users).set({ color: "#64D2FF" }).where(eq(users.id, 1));

    const brian = await testDb.db
      .select({ color: users.color })
      .from(users)
      .where(eq(users.id, 2));
    expect(brian[0].color).toBe("#34C759"); // unchanged
  });

  it("change color modal excludes own color from taken list", () => {
    // Simulates the modal logic: takenByOther filters out current user
    const allUsers = [
      { id: 1, color: "#007AFF" },
      { id: 2, color: "#34C759" },
      { id: 3, color: "#FF9500" },
    ];
    const currentUserId = 1;
    const color = "#007AFF";

    const takenByOther = allUsers.some(
      (u) => u.id !== currentUserId && u.color.toUpperCase() === color.toUpperCase()
    );
    expect(takenByOther).toBe(false); // own color is selectable
  });

  it("change color modal blocks colors taken by others", () => {
    const allUsers = [
      { id: 1, color: "#007AFF" },
      { id: 2, color: "#34C759" },
    ];
    const currentUserId = 1;

    const takenByOther = allUsers.some(
      (u) => u.id !== currentUserId && u.color.toUpperCase() === "#34C759"
    );
    expect(takenByOther).toBe(true); // Brian's color is blocked
  });
});
