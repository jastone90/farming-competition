import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, type TestDb } from "../helpers/test-db";
import { createUser, createAuditEntry } from "../helpers/seed-helpers";
import { auditLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let testDb: TestDb;

beforeEach(async () => {
  testDb = createTestDb();
  await testDb.setup();
});

afterEach(() => {
  testDb.close();
});

const ALL_ACTIONS = [
  "activity_create",
  "activity_delete",
  "amendment_propose",
  "amendment_withdraw",
  "vote_cast",
  "pin_change",
  "user_create",
  "color_change",
  "strava_sync",
] as const;

describe("audit log — all action types roundtrip", () => {
  it.each(ALL_ACTIONS)("stores and retrieves '%s' action", async (action) => {
    await createUser(testDb, { name: "Alan" });

    const entityType = action.startsWith("activity")
      ? "activity"
      : action.startsWith("amendment")
        ? "amendment"
        : action === "vote_cast"
          ? "vote"
          : "user";

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action,
      entityType,
      entityId: 1,
      metadata: JSON.stringify({ test: true, action }),
    });

    expect(entry.action).toBe(action);
    expect(entry.entityType).toBe(entityType);
    const meta = JSON.parse(entry.metadata);
    expect(meta.action).toBe(action);
  });
});

describe("audit log — strava_sync action", () => {
  it("stores strava_sync with sync metadata", async () => {
    await createUser(testDb, { name: "Alan" });

    const metadata = {
      activitiesSynced: 5,
      source: "daily_cron",
      stravaUserId: "12345",
    };

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "strava_sync",
      entityType: "activity",
      metadata: JSON.stringify(metadata),
    });

    expect(entry.action).toBe("strava_sync");
    const meta = JSON.parse(entry.metadata);
    expect(meta.activitiesSynced).toBe(5);
    expect(meta.source).toBe("daily_cron");
  });

  it("strava_sync without entityId is valid", async () => {
    await createUser(testDb, { name: "Alan" });

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "strava_sync",
      entityType: "activity",
    });

    expect(entry.entityId).toBeNull();
    expect(entry.action).toBe("strava_sync");
  });
});

describe("audit log — metadata serialization", () => {
  it("roundtrips nested objects", async () => {
    await createUser(testDb, { name: "Alan" });

    const metadata = {
      activity: { type: "run", distance: 5.2 },
      scoring: { raw: 20.8, modified: 24.96 },
    };

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_create",
      entityType: "activity",
      metadata: JSON.stringify(metadata),
    });

    const parsed = JSON.parse(entry.metadata);
    expect(parsed.activity.type).toBe("run");
    expect(parsed.scoring.modified).toBe(24.96);
  });

  it("roundtrips arrays in metadata", async () => {
    await createUser(testDb, { name: "Alan" });

    const metadata = {
      syncedIds: [101, 102, 103],
      errors: [],
    };

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "strava_sync",
      entityType: "activity",
      metadata: JSON.stringify(metadata),
    });

    const parsed = JSON.parse(entry.metadata);
    expect(parsed.syncedIds).toEqual([101, 102, 103]);
    expect(parsed.errors).toEqual([]);
  });

  it("roundtrips unicode and emoji in metadata", async () => {
    await createUser(testDb, { name: "Alan" });

    const metadata = { title: "Morning Run 🏃‍♂️", note: "café détour" };

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_create",
      entityType: "activity",
      metadata: JSON.stringify(metadata),
    });

    const parsed = JSON.parse(entry.metadata);
    expect(parsed.title).toBe("Morning Run 🏃‍♂️");
    expect(parsed.note).toBe("café détour");
  });

  it("roundtrips null values in metadata fields", async () => {
    await createUser(testDb, { name: "Alan" });

    const metadata = { distance: null, elevation: null, points: 10 };

    const entry = await createAuditEntry(testDb, {
      userId: 1,
      action: "activity_create",
      entityType: "activity",
      metadata: JSON.stringify(metadata),
    });

    const parsed = JSON.parse(entry.metadata);
    expect(parsed.distance).toBeNull();
    expect(parsed.points).toBe(10);
  });
});
